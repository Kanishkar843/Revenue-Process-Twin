import sqlite3
import json
from datetime import datetime
from fastapi import APIRouter, Body

router = APIRouter()
DB_PATH = "data/final/revenue_leaks.db"

@router.post("/api/actions/execute")
def execute_action(payload: dict = Body(...)):
    alert_id = payload.get("alert_id", "ALT-00042")
    action_type = payload.get("action", "mark_re_invoiced")
    actor = payload.get("actor", "user")
    
    executed_at = datetime.utcnow().isoformat() + "Z"

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Append-only audit_log
    cursor.execute(
        """INSERT INTO audit_log (alert_id, action_type, actor, payload_json, executed_at, outcome)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (alert_id, action_type, actor, json.dumps(payload), executed_at, "SUCCESS")
    )
    conn.commit()
    audit_id = cursor.lastrowid
    conn.close()

    return {
        "status": "success",
        "audit_log_id": audit_id,
        "executed_at": executed_at
    }
