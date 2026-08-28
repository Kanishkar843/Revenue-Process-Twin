import os
import random
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

os.makedirs("data/staging", exist_ok=True)
os.makedirs("data/final", exist_ok=True)
os.makedirs("ml/models", exist_ok=True)
os.makedirs("app/api", exist_ok=True)
os.makedirs("app/services", exist_ok=True)
os.makedirs("app/models", exist_ok=True)
os.makedirs("app/db", exist_ok=True)
os.makedirs("tests", exist_ok=True)

random.seed(42)
np.random.seed(42)

# 1. MSME Companies (D7)
company_names = [
    "Acme Corp", "Vertex Ltd", "Neon Retail", "BlueStar", "TechNova Solutions",
    "Apex Global", "Zenith Logistics", "Nexus Enterprises", "Vanguard Systems", "Omicron Tech",
    "Prism Infotech", "Solaria Energy", "Titan Manufacturing", "Orion Digital", "Atlas Retail",
    "Matrix Global", "Elysium Networks", "Krypton Labs", "Horizon Corp", "Quantum Soft",
    "Synergy Infotech", "Aura Enterprises", "CyberNetics", "Starlight Media", "Innovate X",
    "Radiant Pharma", "Pinnacle Traders", "Aegis Security", "Vortex Engineering", "Velocis Tech"
]
regions = ["North", "South", "East", "West", "Central"]
industries = ["IT Services", "Manufacturing", "Retail", "Healthcare", "Logistics", "Finance"]

msme_rows = []
for i in range(250):
    c_name = company_names[i % len(company_names)] + f" {i+1}" if i >= len(company_names) else company_names[i]
    msme_rows.append({
        "Company_Name": c_name,
        "Region": random.choice(regions),
        "Industry": random.choice(industries),
        "GSTIN": f"27AAAAA{i:04d}A1Z5"
    })
df_msme = pd.DataFrame(msme_rows)
df_msme.to_csv("data/staging/msme.csv", index=False)

# 2. SaaS Subscriptions (D4)
plans = ["Starter", "Professional", "Enterprise"]
plan_mrr_map = {"Starter": 5000, "Professional": 20000, "Enterprise": 100000} # INR

saas_rows = []
for i in range(1, 251):
    cid = f"CUST-{i:04d}"
    plan = random.choice(plans)
    signup = datetime(2024, 1, 1) + timedelta(days=random.randint(0, 365))
    saas_rows.append({
        "Customer_ID": cid,
        "Plan_Type": plan,
        "Monthly_Price": plan_mrr_map[plan],
        "Signup_Date": signup.strftime("%Y-%m-%d"),
        "Renewal_Cadence": "Monthly",
        "Status": "Active"
    })
df_saas = pd.DataFrame(saas_rows)
df_saas.to_csv("data/staging/saas.csv", index=False)

# 3. Late Payment Distributions (D6)
late_rows = []
for i in range(1000):
    issue = datetime(2025, 1, 1) + timedelta(days=random.randint(0, 400))
    due = issue + timedelta(days=30)
    # Lateness distribution: 70% on time / early, 20% 1-30 days late, 10% >30 days late
    r = random.random()
    if r < 0.70:
        days_late = random.randint(-5, 0)
    elif r < 0.90:
        days_late = random.randint(1, 30)
    else:
        days_late = random.randint(31, 90)
    paid = due + timedelta(days=days_late)
    late_rows.append({
        "invoice_id": f"INV-HIST-{i:05d}",
        "issue_date": issue.strftime("%Y-%m-%d"),
        "due_date": due.strftime("%Y-%m-%d"),
        "paid_date": paid.strftime("%Y-%m-%d"),
        "days_late": max(0, days_late)
    })
df_late = pd.DataFrame(late_rows)
df_late.to_csv("data/staging/late_payment.csv", index=False)

# 4. Telco Churn (D3) for training XGBoost
telco_rows = []
for i in range(2000):
    cid = f"TELCO-{i:05d}"
    tenure = random.randint(1, 72)
    m_charges = round(random.uniform(20.0, 120.0), 2)
    total_charges = round(m_charges * tenure, 2)
    contract = random.choice(["Month-to-month", "One year", "Two year"])
    support_tickets = random.randint(0, 6)
    rev_decline = random.randint(0, 4)
    failed_pmts = random.randint(0, 3)
    refund_ratio = round(random.uniform(0.0, 0.25), 3)
    renewal_misses = random.randint(0, 2)
    
    # Target churn probability
    logit = -1.5 + 0.05 * support_tickets + 0.4 * rev_decline + 0.3 * failed_pmts + 2.0 * refund_ratio + 0.5 * renewal_misses - 0.02 * tenure
    prob = 1.0 / (1.0 + np.exp(-logit))
    churn = "Yes" if random.random() < prob else "No"
    
    telco_rows.append({
        "customerID": cid,
        "tenure": tenure,
        "Contract": contract,
        "MonthlyCharges": m_charges,
        "TotalCharges": total_charges,
        "support_tickets": support_tickets,
        "revenue_decline_streak": rev_decline,
        "failed_payment_count": failed_pmts,
        "refund_ratio": refund_ratio,
        "renewal_miss_count": renewal_misses,
        "days_since_last_purchase": random.randint(5, 120),
        "plan_mrr": int(m_charges * 100),
        "Churn": churn
    })
df_telco = pd.DataFrame(telco_rows)
df_telco.to_csv("data/staging/telco_churn.csv", index=False)

# 5. Online Retail II (D1) Backbone
retail_rows = []
base_date = datetime(2025, 1, 1)

# Generate baseline invoices across 250 customers
invoice_counter = 1000
for c_idx in range(1, 251):
    cid = f"CUST-{c_idx:04d}"
    num_inv = random.randint(4, 8)
    for j in range(num_inv):
        invoice_counter += 1
        inv_no = f"INV-{invoice_counter}"
        inv_date = base_date + timedelta(days=random.randint(0, 360))
        gbp_price = round(random.uniform(50.0, 500.0), 2)
        qty = random.randint(1, 5)
        
        # 5% cancellations (refunds)
        is_cancel = (random.random() < 0.05)
        if is_cancel:
            inv_no = f"C{invoice_counter}"
        
        retail_rows.append({
            "Invoice": inv_no,
            "StockCode": f"SKU-{random.randint(100, 999)}",
            "Description": "SaaS Platform Usage & Addons",
            "Quantity": qty,
            "InvoiceDate": inv_date.strftime("%Y-%m-%d %H:%M:%S"),
            "Price": gbp_price,
            "CustomerID": cid,
            "Country": "United Kingdom"
        })

df_retail = pd.DataFrame(retail_rows)
df_retail.to_csv("data/staging/online_retail_ii.csv", index=False)
print("Staging datasets successfully generated in data/staging/")
