import os
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from app.services.event_log_builder import build_event_log

DB_PATH = "data/final/revenue_leaks.db"
SCHEMA_PATH = "schema.sql"
STAGING_DIR = "data/staging"

def build_database():
    print("Building database from staging CSVs...")
    
    if os.path.exists(DB_PATH) and os.path.getsize(DB_PATH) > 1000:
        print(f"Database already exists at {DB_PATH} ({os.path.getsize(DB_PATH)} bytes). Skipping rebuild.")
        return

    # Ensure output directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    # 1. Initialize SQLite schema
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_script = f.read()
    cursor.executescript(schema_script)
    conn.commit()

    if not os.path.exists(STAGING_DIR):
        print(f"Staging directory {STAGING_DIR} not found. DB initialized with schema.")
        conn.close()
        return

    # Load staging datasets
    df_retail = pd.read_csv(f"{STAGING_DIR}/online_retail_ii.csv")
    df_saas = pd.read_csv(f"{STAGING_DIR}/saas.csv")
    df_msme = pd.read_csv(f"{STAGING_DIR}/msme.csv")
    df_late = pd.read_csv(f"{STAGING_DIR}/late_payment.csv")

    # GBP to INR to Paise: 1 GBP = 105 INR = 10500 paise
    GBP_TO_PAISE = 10500

    # 2. Build Customers (>=200 customers)
    customers = []
    customer_ids = df_saas["Customer_ID"].unique()
    
    for idx, cid in enumerate(customer_ids):
        saas_row = df_saas[df_saas["Customer_ID"] == cid].iloc[0]
        msme_row = df_msme.iloc[idx % len(df_msme)]
        
        name = msme_row["Company_Name"]
        plan = saas_row["Plan_Type"]
        segment = "enterprise" if plan == "Enterprise" else "smb"
        plan_mrr_paise = int(saas_row["Monthly_Price"]) * 100
        created_at = str(saas_row["Signup_Date"]) if pd.notna(saas_row.get("Signup_Date")) and str(saas_row.get("Signup_Date")) != "nan" else "2024-01-15"
        region = msme_row["Region"] if pd.notna(msme_row.get("Region")) else "North"
        
        customers.append((cid, name, segment, plan, plan_mrr_paise, created_at, region))
    
    # Inject exact seed customers if not already present
    seed_custs = {
        "CUST-0042": ("Acme Corp", "enterprise", "Enterprise", 10000000, "2024-01-15", "North"),
        "CUST-0108": ("Vertex Ltd", "smb", "Professional", 2000000, "2024-02-10", "West"),
        "CUST-0077": ("Neon Retail", "smb", "Professional", 2000000, "2024-03-05", "South"),
        "CUST-0031": ("BlueStar", "enterprise", "Enterprise", 10000000, "2024-01-20", "Central"),
        "CUST-0107": ("Apex Cyber", "enterprise", "Enterprise", 10000000, "2024-02-01", "East")
    }
    
    existing_cids = {c[0] for c in customers}
    for sc_id, sc_info in seed_custs.items():
        if sc_id not in existing_cids:
            customers.append((sc_id, sc_info[0], sc_info[1], sc_info[2], sc_info[3], sc_info[4], sc_info[5]))
        else:
            # Overwrite with exact seed name & plan
            for i, c in enumerate(customers):
                if c[0] == sc_id:
                    customers[i] = (sc_id, sc_info[0], sc_info[1], sc_info[2], sc_info[3], sc_info[4], sc_info[5])

    cursor.executemany(
        "INSERT INTO customers (customer_id, name, segment, plan, plan_mrr_paise, created_at, region) VALUES (?, ?, ?, ?, ?, ?, ?)",
        customers
    )
    conn.commit()

    # 3. Build Invoices, Payments, Transactions, Renewals
    invoices = []
    payments = []
    transactions = []
    renewals = []

    inv_counter = 1000
    pay_counter = 1000
    txn_counter = 1000
    ren_counter = 1000

    # Map retail dataset invoices
    for _, row in df_retail.iterrows():
        cid = str(row["CustomerID"])
        if cid not in seed_custs and cid in existing_cids:
            inv_counter += 1
            inv_id = f"INV-{inv_counter}"
            issue_date = str(row["InvoiceDate"])[:10]
            issue_dt = datetime.strptime(issue_date, "%Y-%m-%d")
            due_date = (issue_dt + timedelta(days=30)).strftime("%Y-%m-%d")
            
            gbp_amt = float(row["Price"]) * int(row["Quantity"])
            amt_paise = max(100000, int(gbp_amt * GBP_TO_PAISE))
            
            discount_pct = 0.0
            if np.random.random() < 0.15:
                discount_pct = round(np.random.uniform(0.05, 0.15), 2)
                
            status = "paid"
            contract_ref = f"CTR-{cid}" if np.random.random() < 0.8 else None
            
            is_cancel = str(row["Invoice"]).startswith("C")
            if is_cancel:
                status = "void"
                txn_counter += 1
                transactions.append((f"TXN-{txn_counter}", cid, amt_paise, "refund", issue_date))
            else:
                invoices.append((inv_id, cid, issue_date, due_date, amt_paise, discount_pct, status, contract_ref))
                
                # Payment
                pay_counter += 1
                payments.append((f"PAY-{pay_counter}", inv_id, cid, amt_paise, "upi", "success", f"{issue_date}T12:00:00Z", 1))
                
                txn_counter += 1
                transactions.append((f"TXN-{txn_counter}", cid, amt_paise, "purchase", issue_date))

    # Add background renewals for general customers
    for cid in list(existing_cids)[:200]:
        ren_counter += 1
        ren_id = f"REN-{ren_counter}"
        due_d = "2025-07-01"
        renewals.append((ren_id, cid, due_d, "renewed", 1, f"{due_d}T10:00:00Z"))

    # 4. INJECT SEED LEAKS (Exact S01, S02, S03, S04)
    # S01: Acme Corp (CUST-0042) - Over-Discount 55-68% vs 12% plan median, 11 invoices
    # Leak amount: ~₹4.2L (42,000,000 paise).
    for k in range(1, 12):
        s01_inv_id = f"INV-100{k:02d}"
        iss_d = f"2025-0{min(k,9)}-12" if k <= 9 else f"2025-1{k-9}-12"
        due_d = f"2025-0{min(k,9)}-25" if k <= 9 else f"2025-1{k-9}-25"
        amt_paise = 5600000  # ₹56,000 each (Total 11 * 56,000 = ₹6.16L gross, discount gap = ~₹4.2L)
        disc_pct = 0.68 if k % 2 == 0 else 0.55
        
        invoices.append((s01_inv_id, "CUST-0042", iss_d, due_d, amt_paise, disc_pct, "issued", "CTR-0042"))
        pay_counter += 1
        payments.append((f"PAY-S01-{k}", s01_inv_id, "CUST-0042", int(amt_paise * (1 - disc_pct)), "wire", "success", f"{iss_d}T15:00:00Z", 1))

    # S02: Vertex Ltd (CUST-0108) - Duplicate payment on one invoice (2 successful pays) ₹1.2L (12000000 paise)
    s02_inv_id = "INV-20108"
    invoices.append((s02_inv_id, "CUST-0108", "2025-04-10", "2025-05-10", 12000000, 0.0, "paid", "CTR-0108"))
    payments.append(("PAY-20108-1", s02_inv_id, "CUST-0108", 12000000, "card", "success", "2025-04-12T10:00:00Z", 1))
    payments.append(("PAY-20108-2", s02_inv_id, "CUST-0108", 12000000, "card", "duplicate", "2025-04-12T10:05:00Z", 2))

    # S03: Neon Retail (CUST-0077) - 3 consecutive months revenue decline >20% + missed renewal
    # Declining transactions
    txn_counter += 1
    transactions.append((f"TXN-{txn_counter}", "CUST-0077", 25000000, "purchase", "2025-02-15"))
    txn_counter += 1
    transactions.append((f"TXN-{txn_counter}", "CUST-0077", 18000000, "purchase", "2025-03-15"))
    txn_counter += 1
    transactions.append((f"TXN-{txn_counter}", "CUST-0077", 12000000, "purchase", "2025-04-15"))
    txn_counter += 1
    transactions.append((f"TXN-{txn_counter}", "CUST-0077", 8000000, "purchase", "2025-05-15"))
    
    ren_counter += 1
    renewals.append((f"REN-00077", "CUST-0077", "2025-06-01", "missed", 2, "2025-06-05T00:00:00Z"))

    # S04: BlueStar (CUST-0031) - Enterprise discount without contract_ref (25% > 20%)
    s04_inv_id = "INV-20031"
    invoices.append((s04_inv_id, "CUST-0031", "2025-05-01", "2025-06-01", 18000000, 0.25, "issued", None))
    payments.append(("PAY-20031-1", s04_inv_id, "CUST-0031", 13500000, "wire", "success", "2025-05-05T11:00:00Z", 1))

    # Execute DB insertions
    cursor.executemany(
        "INSERT INTO invoices (invoice_id, customer_id, issue_date, due_date, amount_paise, discount_pct, status, contract_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        invoices
    )
    cursor.executemany(
        "INSERT INTO payments (payment_id, invoice_id, customer_id, amount_paise, method, status, payment_ts, attempt_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        payments
    )
    cursor.executemany(
        "INSERT INTO transactions (txn_id, customer_id, amount_paise, type, txn_ts) VALUES (?, ?, ?, ?, ?)",
        transactions
    )
    cursor.executemany(
        "INSERT INTO renewals (renewal_id, customer_id, due_date, status, attempt_count, last_attempt_ts) VALUES (?, ?, ?, ?, ?, ?)",
        renewals
    )
    conn.commit()
    conn.close()

    # 5. Build Event Log
    event_count = build_event_log(DB_PATH)

    # 5b. Persist Evaluated Alerts into `alerts` SQLite table (Gap 4 fix)
    from app.services.detection_rules import evaluate_rules
    from app.services.conformance_engine import evaluate_conformance
    from app.services.counterfactual_engine import calculate_recoverable_paise, CF_TEMPLATES
    import json

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    raw_rule_alerts = evaluate_rules(DB_PATH)
    raw_conf_alerts = evaluate_conformance(DB_PATH)
    
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

    cursor.executemany("""
        INSERT OR REPLACE INTO alerts (
            alert_id, customer_id, rule_id, leak_type, severity, leak_amount_paise, recoverable_paise,
            process_break_step, expected_next, actual_next, connected_entities_json, recommended_action,
            action_confidence, evidence_json, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, alerts_to_insert)
    conn.commit()

    # 6. Verify Database counts
    n_cust = cursor.execute("SELECT COUNT(*) FROM customers;").fetchone()[0]
    n_inv = cursor.execute("SELECT COUNT(*) FROM invoices;").fetchone()[0]
    n_pay = cursor.execute("SELECT COUNT(*) FROM payments;").fetchone()[0]
    n_evt = cursor.execute("SELECT COUNT(*) FROM event_log;").fetchone()[0]
    n_alt = cursor.execute("SELECT COUNT(*) FROM alerts;").fetchone()[0]
    conn.close()

    print(f"Database build complete!")
    print(f"Customers: {n_cust}, Invoices: {n_inv}, Payments: {n_pay}, Event Log Rows: {n_evt}, Alerts: {n_alt}")
    assert n_cust >= 200, f"Customer count {n_cust} < 200"
    assert n_inv >= 1000, f"Invoice count {n_inv} < 1000"
    assert n_pay >= 800, f"Payment count {n_pay} < 800"
    assert n_evt >= 3000, f"Event log count {n_evt} < 3000"
    print("Validation V1 passed!")

if __name__ == "__main__":
    build_database()
