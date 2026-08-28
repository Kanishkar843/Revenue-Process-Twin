import sqlite3
import json
from typing import Optional
from fastapi import APIRouter, Query
from app.db.connection import get_connection
from app.services.counterfactual_engine import calculate_recoverable_paise

router = APIRouter()

RECOVERY_RECOMMENDATIONS = {
    "overdue_invoice": "Reissue invoice, trigger automated payment reminders, and escalate to collections.",
    "invoice_overdue": "Reissue invoice, trigger automated payment reminders, and escalate to collections.",
    "over_discount": "Normalize discount tier to approved plan policy and generate adjustment debit memo.",
    "duplicate_payment": "Trigger automated refund reversal / ledger adjustment for duplicate payment.",
    "spurious_refund": "Flag refund anomaly for compliance audit and initiate credit hold.",
    "high_refund_ratio": "Flag refund anomaly for compliance audit and initiate credit hold.",
    "missed_renewal": "Dispatch automated Executive Success Outreach and contract renewal offer.",
    "silent_churn": "Dispatch automated Executive Success Outreach and contract renewal offer.",
    "contractless_enterprise_discount": "Require contract reference or revert enterprise discount to standard tier.",
    "duplicate_invoice": "Cancel duplicate invoice and reconcile ledger.",
    "missing_payment": "Reconcile payment gateway logs and issue collection request."
}

@router.get("/api/recovery")
def get_recovery_cases(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    status: Optional[str] = None
):
    """Returns real dynamic recovery cases derived from SQLite alerts table."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        where_clauses = []
        params = []
        if status:
            where_clauses.append("a.status = ?")
            params.append(status)
            
        where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        
        total = cursor.execute(f"SELECT COUNT(*) FROM alerts a {where_str};", params).fetchone()[0]
        
        offset = (page - 1) * page_size
        query = f"""
            SELECT a.alert_id, a.customer_id, c.name as customer_name, a.rule_id, a.leak_type,
                   a.severity, a.leak_amount_paise, a.recoverable_paise, a.recommended_action,
                   a.action_confidence, a.status, a.created_at
            FROM alerts a
            LEFT JOIN customers c ON a.customer_id = c.customer_id
            {where_str}
            ORDER BY a.leak_amount_paise DESC
            LIMIT ? OFFSET ?;
        """
        params.extend([page_size, offset])
        rows = cursor.execute(query, params).fetchall()
        
        cases = []
        for r in rows:
            leak_type = r["leak_type"]
            leak_p = r["leak_amount_paise"] or 0
            rec_p = r["recoverable_paise"] if r["recoverable_paise"] else calculate_recoverable_paise(leak_type, leak_p)
            
            rec_action = r["recommended_action"] or RECOVERY_RECOMMENDATIONS.get(
                leak_type, "Execute counterfactual adjustment per SLA terms."
            )
            
            cases.append({
                "id": r["alert_id"],
                "customer_id": r["customer_id"],
                "customer": r["customer_name"] or r["customer_id"],
                "issue": f"{leak_type.replace('_', ' ').title()} breach detected via rule {r['rule_id']}",
                "leakageRs": float(leak_p) / 100.0,
                "recoverableRs": float(rec_p) / 100.0,
                "confidencePct": int((r["action_confidence"] or 0.85) * 100),
                "recommendedAction": rec_action,
                "status": "executed" if r["status"] == "resolved" else ("ready" if r["status"] == "open" else "pending_approval"),
                "created_at": r["created_at"]
            })
            
        return {
            "page": page,
            "page_size": page_size,
            "total": total,
            "cases": cases
        }
