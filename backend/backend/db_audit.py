import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "final", "revenue_leaks.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db_summary.txt")
with open(out_path, "w", encoding="utf-8") as f:
    f.write("=== TABLES & RECORD COUNTS ===\n")
    tables = [r[0] for r in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    for t in tables:
        cnt = cursor.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        f.write(f"{t}: {cnt} records\n")

    f.write("\n=== ALERTS RULE_ID BREAKDOWN ===\n")
    rows = cursor.execute("SELECT rule_id, leak_type, COUNT(*) FROM alerts GROUP BY rule_id, leak_type ORDER BY COUNT(*) DESC").fetchall()
    for r in rows:
        f.write(f"Rule {r[0]} ({r[1]}): {r[2]} alerts\n")

    f.write("\n=== SAMPLE ALERTS (First 50) ===\n")
    rows = cursor.execute("SELECT alert_id, customer_id, rule_id, leak_type, severity, leak_amount_paise, recoverable_paise FROM alerts LIMIT 50").fetchall()
    for r in rows:
        f.write(str(r) + "\n")

print("Wrote db_summary.txt successfully.")
