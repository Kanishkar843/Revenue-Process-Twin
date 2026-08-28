import sqlite3
import json
from datetime import datetime
from fastapi import APIRouter, Body, Depends
from app.db.connection import get_connection
from app.services.auth_service import get_current_user

router = APIRouter()

@router.post("/api/actions/execute")
def execute_action(
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("sub", "system")
    alert_id = payload.get("alert_id", "ALT-00042")
    action_type = payload.get("action", "mark_re_invoiced")
    actor = payload.get("actor", "user")
    
    executed_at = datetime.utcnow().isoformat() + "Z"

    with get_connection() as conn:
        cursor = conn.cursor()
        # Append-only audit_log with user_id scoping
        cursor.execute(
            """INSERT INTO audit_log (user_id, alert_id, action_type, actor, payload_json, executed_at, outcome)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (user_id, alert_id, action_type, actor, json.dumps(payload), executed_at, "SUCCESS")
        )
        conn.commit()
        audit_id = cursor.lastrowid

    return {
        "status": "success",
        "audit_log_id": audit_id,
        "executed_at": executed_at
    }
