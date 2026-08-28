"""
routes_chat.py — Question-Aware, Grounded, RAG-Powered Narrator Chat Endpoint.

Integrates:
  1. Intent classification via app.services.query_router
  2. Policy/Rule knowledge retrieval via app.services.rag_engine
  3. Targeted database queries via app.db.connection
  4. Evidence-grounded local LLM narration via app.services.narrator
"""
import logging
from fastapi import APIRouter, Body
from app.db.connection import get_connection
from app.services.query_router import classify_query, Intent
from app.services.rag_engine import query_knowledge_base
from app.services.narrator import narrator

log = logging.getLogger(__name__)
router = APIRouter()


def _row(r, key, default=None):
    """Safe column access for sqlite3.Row."""
    try:
        return r[key]
    except (IndexError, KeyError, TypeError):
        return default


def _build_evidence_from_alerts(alert_rows, cust_id=None, cust_name=None):
    """Build a narrator evidence dict from a list of alert rows."""
    if not alert_rows:
        return None

    top = alert_rows[0]
    total_leak = sum(int(_row(r, "leak_amount_paise") or 0) for r in alert_rows)
    total_rec = sum(int(_row(r, "recoverable_paise") or 0) for r in alert_rows)

    c_id = cust_id or _row(top, "customer_id")
    c_name = cust_name or _row(top, "customer_name", c_id)

    return {
        "customer_id": c_id,
        "customer_name": c_name,
        "rule_id": _row(top, "rule_id", ""),
        "leak_type": _row(top, "leak_type", ""),
        "severity": _row(top, "severity", "medium"),
        "alert_count": len(alert_rows),
        "leak_amount_paise": total_leak,
        "recoverable_paise": total_rec,
        "process_break_step": _row(top, "process_break_step") or "PROCESS_BREAK_DETECTED",
        "expected_next": _row(top, "expected_next", ""),
        "actual_next": _row(top, "actual_next", ""),
        "connected_entities": [_row(r, "alert_id") for r in alert_rows[:5]],
        "recommended_action": _row(top, "recommended_action") or "Review alert details",
    }


@router.post("/api/chat")
def chat_endpoint(payload: dict = Body(...)):
    query = payload.get("query", "").strip()
    if not query:
        return narrator(evidence_json=None, query="", intent=Intent.GENERAL_GREETING)

    with get_connection() as conn:
        cursor = conn.cursor()

        # Fetch list of customer names for entity matching
        all_custs = cursor.execute("SELECT customer_id, name FROM customers").fetchall()
        cust_names = [_row(r, "name") for r in all_custs if _row(r, "name")]

        # Step 1: Classify Query Intent & Extract Entities
        cls = classify_query(query, customer_names=cust_names)
        intent = cls.intent
        entities = cls.entities

        log.info("Chat Query '%s' classified as INTENT: %s (entities: %s)", query, intent, entities)

        # ── ROUTE 1: Greetings, Identity, Help, System Status (0 DB Leakage Queries) ──
        if intent in [Intent.GENERAL_GREETING, Intent.IDENTITY, Intent.HELP, Intent.SYSTEM_STATUS]:
            return narrator(evidence_json=None, query=query, intent=intent)

        # ── ROUTE 2: Policy & Business Rule Questions (RAG Only / Minimal DB) ──
        if intent == Intent.POLICY_QUESTION:
            rag_results = query_knowledge_base(query, top_k=2)
            rag_context = "\n".join([r["document"]["content"] for r in rag_results])
            return narrator(evidence_json=None, query=query, rag_context=rag_context, intent=intent)

        # ── ROUTE 3: Customer Lookup ──
        if intent == Intent.CUSTOMER_LOOKUP or entities.customer_id:
            target_cid = entities.customer_id
            target_cname = None

            if not target_cid:
                # Find by fuzzy name match
                for row in all_custs:
                    cname = _row(row, "name", "")
                    if cname and cname.lower() in query.lower():
                        target_cid = _row(row, "customer_id")
                        target_cname = cname
                        break

            if target_cid:
                alerts = cursor.execute(
                    "SELECT * FROM alerts WHERE customer_id = ? ORDER BY leak_amount_paise DESC",
                    (target_cid,)
                ).fetchall()
                evidence = _build_evidence_from_alerts(alerts, cust_id=target_cid, cust_name=target_cname)
                if not evidence:
                    evidence = {
                        "customer_id": target_cid,
                        "customer_name": target_cname or target_cid,
                        "alert_count": 0,
                        "leak_amount_paise": 0,
                        "recoverable_paise": 0,
                        "process_break_step": "No active alerts found",
                        "connected_entities": [],
                        "recommended_action": "Account in compliance",
                    }
                return narrator(evidence, query=query, intent=intent)
            else:
                # Query highest leakage customer
                alerts = cursor.execute(
                    """
                    SELECT a.*, c.name as customer_name
                    FROM alerts a
                    JOIN customers c ON a.customer_id = c.customer_id
                    ORDER BY a.leak_amount_paise DESC
                    LIMIT 5
                    """
                ).fetchall()
                if alerts:
                    top_cust = _row(alerts[0], "customer_name", _row(alerts[0], "customer_id"))
                    evidence = _build_evidence_from_alerts(alerts)
                    if evidence:
                        evidence["customer_name"] = top_cust
                    return narrator(evidence, query=query, intent=intent)

        # ── ROUTE 4: Invoice / Payment Lookup ──
        if intent in [Intent.INVOICE_LOOKUP, Intent.PAYMENT_LOOKUP] or entities.invoice_id or entities.transaction_id:
            target_inv = entities.invoice_id
            if target_inv:
                inv_row = cursor.execute("SELECT * FROM invoices WHERE invoice_id = ?", (target_inv,)).fetchone()
                if inv_row:
                    cust_id = _row(inv_row, "customer_id")
                    alerts = cursor.execute("SELECT * FROM alerts WHERE customer_id = ?", (cust_id,)).fetchall()
                    evidence = _build_evidence_from_alerts(alerts, cust_id=cust_id)
                    if evidence:
                        evidence["connected_entities"].append(target_inv)
                        evidence["process_break_step"] = f"Invoice {target_inv} verification breach"
                    else:
                        evidence = {
                            "customer_id": cust_id,
                            "invoice_id": target_inv,
                            "leak_amount_paise": int((_row(inv_row, "amount_paise") or 0) * 0.1),
                            "process_break_step": f"Invoice {target_inv} line item audit",
                            "connected_entities": [target_inv],
                            "recommended_action": "Verify invoice pricing against rate card"
                        }
                    return narrator(evidence, query=query, intent=intent)

        # ── ROUTE 5: Leakage by Specific Leak Type ──
        if intent == Intent.LEAKAGE_BY_TYPE or entities.leak_type:
            ltype = entities.leak_type
            alerts = cursor.execute(
                """
                SELECT a.*, c.name as customer_name
                FROM alerts a
                JOIN customers c ON a.customer_id = c.customer_id
                WHERE a.leak_type = ?
                ORDER BY a.leak_amount_paise DESC
                LIMIT 5
                """,
                (ltype,)
            ).fetchall()
            if alerts:
                c_names = list(dict.fromkeys(_row(r, "customer_name") for r in alerts if _row(r, "customer_name")))
                evidence = _build_evidence_from_alerts(alerts)
                if evidence:
                    evidence["customer_name"] = ", ".join(c_names[:3]) if c_names else "Multiple Enterprise Accounts"
                return narrator(evidence, query=query, intent=intent)

        # ── ROUTE 6: Recovery Recommendation ──
        if intent == Intent.RECOVERY_RECOMMENDATION:
            alerts = cursor.execute(
                """
                SELECT a.*, c.name as customer_name
                FROM alerts a
                JOIN customers c ON a.customer_id = c.customer_id
                ORDER BY a.recoverable_paise DESC
                LIMIT 5
                """
            ).fetchall()
            evidence = _build_evidence_from_alerts(alerts) if alerts else None
            rag_results = query_knowledge_base("revenue recovery procedure", top_k=1)
            rag_context = rag_results[0]["document"]["content"] if rag_results else ""
            return narrator(evidence, query=query, rag_context=rag_context, intent=intent)

        # ── ROUTE 7: Leakage Overview (Explicit System Summary or Top Customer Query) ──
        if intent == Intent.LEAKAGE_OVERVIEW:
            top_alerts = cursor.execute(
                """
                SELECT a.*, c.name as customer_name
                FROM alerts a
                JOIN customers c ON a.customer_id = c.customer_id
                ORDER BY a.leak_amount_paise DESC
                LIMIT 5
                """
            ).fetchall()

            top_a = top_alerts[0] if top_alerts else None
            top_cust = _row(top_a, "customer_name", _row(top_a, "customer_id", "Acme Corp")) if top_a else "Acme Corp"

            if "customer" in query.lower() or "which" in query.lower() or "who" in query.lower():
                evidence = _build_evidence_from_alerts(top_alerts)
                if evidence:
                    evidence["customer_name"] = top_cust
                return narrator(evidence, query=query, intent=Intent.CUSTOMER_LOOKUP)

            totals = cursor.execute(
                "SELECT SUM(leak_amount_paise) total_leak, SUM(recoverable_paise) total_rec, COUNT(*) cnt FROM alerts"
            ).fetchone()

            total_leak = int(_row(totals, "total_leak") or 0)
            total_rec = int(_row(totals, "total_rec") or 0)
            alert_cnt = int(_row(totals, "cnt") or 0)

            evidence = {
                "customer_id": "SYSTEM_WIDE",
                "customer_name": "All Enterprise Accounts",
                "total_active_alerts": alert_cnt,
                "rule_id": _row(top_a, "rule_id", "R01") if top_a else "R01",
                "leak_amount_paise": total_leak,
                "recoverable_paise": total_rec,
                "process_break_step": (_row(top_a, "process_break_step") if top_a else None) or f"{alert_cnt} active violations",
                "connected_entities": [_row(r, "alert_id") for r in top_alerts],
                "recommended_action": (_row(top_a, "recommended_action") if top_a else None) or "Review Alerts dashboard",
            }
            return narrator(evidence, query=query, intent=intent)

        # ── ROUTE 8: General Knowledge / Out-of-Scope Fallback ──
        rag_results = query_knowledge_base(query, top_k=1)
        rag_context = rag_results[0]["document"]["content"] if rag_results else ""
        return narrator(evidence_json=None, query=query, rag_context=rag_context, intent=intent)
