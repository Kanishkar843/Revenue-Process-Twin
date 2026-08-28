import json
from typing import Optional
from fastapi import APIRouter, Query, Depends
from app.db.connection import get_connection
from app.services.auth_service import get_current_user

router = APIRouter()

@router.get("/api/audit")
@router.get("/api/audit-log")
def get_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Retrieve immutable, tamper-evident audit ledger entries."""
    user_id = current_user["sub"]
    with get_connection() as conn:
        cursor = conn.cursor()
        count = cursor.execute("SELECT COUNT(*) FROM audit_log WHERE user_id = ?;", (user_id,)).fetchone()[0]
        offset = (page - 1) * page_size
        rows = cursor.execute("""
            SELECT * FROM audit_log WHERE user_id = ? ORDER BY executed_at DESC LIMIT ? OFFSET ?
        """, (user_id, page_size, offset)).fetchall()

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
