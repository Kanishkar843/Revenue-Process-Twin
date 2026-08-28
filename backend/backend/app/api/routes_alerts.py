import json
import sqlite3
from typing import Optional
from fastapi import APIRouter, Query, Depends
from app.db.connection import get_connection, get_db_path
from app.services.conformance_engine import evaluate_conformance
from app.services.detection_rules import evaluate_rules
from app.services.counterfactual_engine import calculate_recoverable_paise, CF_TEMPLATES
from app.services.auth_service import get_current_user

router = APIRouter()

def rebuild_alerts(db_path: str = None, force: bool = False):
    """Evaluates detection rules and process conformance, updating the DB alerts table."""
    if not db_path:
        db_path = get_db_path()
    with get_connection() as conn:
        cursor = conn.cursor()
        count = cursor.execute("SELECT COUNT(*) FROM alerts;").fetchone()[0]
        if count == 0 or force:
            raw_rule_alerts = evaluate_rules(db_path)
            raw_conf_alerts = evaluate_conformance(db_path)
            seen_keys = set()
            alerts_to_insert = []
            for item in raw_rule_alerts + raw_conf_alerts:
                cust_id = item["customer_id"]
                rule_id = item["rule_id"]
                key = (cust_id, rule_id)
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                alert_id = f"ALT-{cust_id.replace('CUST-', '')}-{rule_id}"
                leak_type = item["leak_type"]
                sev = item["severity"]
                leak_paise = item["leak_amount_paise"]
                rec_paise = calculate_recoverable_paise(leak_type, leak_paise)
                proc_step = item.get("process_break_step", "INVOICE_ISSUED")
                exp_next = item.get("expected_next", "PAYMENT_SUCCEEDED")
                act_next = item.get("actual_next", "DEVIATION")
                conn_entities = json.dumps(item.get("connected_entities", [cust_id, rule_id]))
                rec_action = item.get("recommended_action") or CF_TEMPLATES.get("CF02", {}).get("action", "Normalize discount to plan median")
                confidence = 0.85
                evidence_json = json.dumps(item.get("evidence_json", {"evidence": item.get("evidence", "")}))
                created_at = "2026-08-20T10:15:00Z"
                alerts_to_insert.append((
                    alert_id, cust_id, rule_id, leak_type, sev, leak_paise, rec_paise,
                    proc_step, exp_next, act_next, conn_entities, rec_action, confidence,
                    evidence_json, "open", created_at
                ))
            
            if force:
                cursor.execute("DELETE FROM alerts;")
            cursor.executemany("""
                INSERT OR REPLACE INTO alerts (
                    alert_id, customer_id, rule_id, leak_type, severity, leak_amount_paise, recoverable_paise,
                    process_break_step, expected_next, actual_next, connected_entities_json, recommended_action,
                    action_confidence, evidence_json, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, alerts_to_insert)

def sync_alerts_if_needed():
    rebuild_alerts(force=False)

@router.get("/api/alerts")
def get_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    severity: Optional[str] = None,
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub", "system")
    sync_alerts_if_needed()
    with get_connection() as conn:
        cursor = conn.cursor()
        
        where_clauses = ["a.user_id = ?"]
        params = [user_id]
        if severity:
            where_clauses.append("a.severity = ?")
            params.append(severity)
        if status:
            where_clauses.append("a.status = ?")
            params.append(status)
        if customer_id:
            where_clauses.append("a.customer_id = ?")
            params.append(customer_id)

        where_sql = "WHERE " + " AND ".join(where_clauses)

        # Total count query
        count_query = f"SELECT COUNT(*) FROM alerts a {where_sql}"
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]

        # Paginated items query
        offset = (page - 1) * page_size
        items_query = f"""
            SELECT a.*, c.name as customer_name
            FROM alerts a
            LEFT JOIN customers c ON a.customer_id = c.customer_id AND c.user_id = a.user_id
            {where_sql}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        """
        cursor.execute(items_query, params + [page_size, offset])
        rows = cursor.fetchall()

        alerts_list = []
        for r in rows:
            alerts_list.append({
                "alert_id": r["alert_id"],
                "customer_id": r["customer_id"],
                "customer_name": r["customer_name"],
                "rule_id": r["rule_id"],
                "leak_type": r["leak_type"],
                "severity": r["severity"],
                "leak_amount_rs": float(r["leak_amount_paise"]) / 100.0,
                "recoverable_rs": float(r["recoverable_paise"]) / 100.0,
                "process_break_step": r["process_break_step"],
                "expected_next": r["expected_next"],
                "actual_next": r["actual_next"],
                "recommended_action": r["recommended_action"],
                "status": r["status"],
                "created_at": r["created_at"]
            })

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "alerts": alerts_list
    }
