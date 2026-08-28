import json
from typing import Optional
from fastapi import APIRouter, Query
from app.db.connection import get_connection

router = APIRouter()

@router.get("/api/audit")
@router.get("/api/audit-log")
def get_audit_log(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200)):
    """Retrieve immutable, tamper-evident audit ledger entries."""
    with get_connection() as conn:
        cursor = conn.cursor()
        count = cursor.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
        offset = (page - 1) * page_size
        rows = cursor.execute("""
            SELECT * FROM audit_log ORDER BY executed_at DESC LIMIT ? OFFSET ?
        """, (page_size, offset)).fetchall()

        entries = []
        for r in rows:
            entries.append({
                "log_id": r["log_id"],
                "alert_id": r["alert_id"],
                "action_type": r["action_type"],
                "actor": r["actor"],
                "payload": json.loads(r["payload_json"]) if r["payload_json"] else {},
                "executed_at": r["executed_at"],
                "outcome": r["outcome"]
            })

    return {
        "page": page,
        "page_size": page_size,
        "total": count,
        "entries": entries
    }
