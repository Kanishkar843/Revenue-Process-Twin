import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.db.connection import get_connection

with get_connection() as conn:
    cursor = conn.cursor()
    total = cursor.execute("SELECT COUNT(*) FROM alerts;").fetchone()[0]
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "new_db_summary.txt")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"=== NEW TOTAL ALERTS: {total} ===\n\n")
        f.write("=== RULE_ID & LEAK_TYPE BREAKDOWN ===\n")
        rows = cursor.execute("SELECT rule_id, leak_type, COUNT(*) FROM alerts GROUP BY rule_id, leak_type ORDER BY COUNT(*) DESC").fetchall()
        for r in rows:
            f.write(f"Rule {r['rule_id']} ({r['leak_type']}): {r['COUNT(*)']} alerts\n")

        f.write("\n=== SAMPLE NEW ALERTS (First 30) ===\n")
        rows = cursor.execute("SELECT alert_id, customer_id, rule_id, leak_type, severity, leak_amount_paise / 100.0 as leak_rs, recoverable_paise / 100.0 as rec_rs FROM alerts LIMIT 30").fetchall()
        for r in rows:
            f.write(str(dict(r)) + "\n")

print("Wrote new_db_summary.txt.")
