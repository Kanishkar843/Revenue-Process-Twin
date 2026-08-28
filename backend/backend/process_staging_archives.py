import os
import glob
import pandas as pd
import numpy as np

def process_archives():
    print("Processing attached raw dataset files into data/staging...")

    staging_dir = "data/staging"

    # 1. Telco Churn (D3)
    telco_path = glob.glob(f"{staging_dir}/**/WA_Fn-UseC_-Telco-Customer-Churn.csv", recursive=True)
    if telco_path:
        df_telco = pd.read_csv(telco_path[0])
        if "revenue_decline_streak" not in df_telco.columns:
            np.random.seed(42)
            df_telco["revenue_decline_streak"] = np.random.choice([0, 1, 2, 3], len(df_telco), p=[0.7, 0.15, 0.1, 0.05])
            df_telco["failed_payment_count"] = np.random.choice([0, 1, 2], len(df_telco), p=[0.8, 0.15, 0.05])
            df_telco["refund_ratio"] = np.random.uniform(0.0, 0.20, len(df_telco))
            df_telco["renewal_miss_count"] = np.random.choice([0, 1], len(df_telco), p=[0.85, 0.15])
            df_telco["days_since_last_purchase"] = np.random.randint(5, 90, len(df_telco))
            df_telco["plan_mrr"] = (df_telco["MonthlyCharges"] * 100).astype(int)
            df_telco["support_tickets"] = np.random.randint(0, 5, len(df_telco))
        df_telco.to_csv(f"{staging_dir}/telco_churn.csv", index=False)
        print("Processed telco_churn.csv")

    # 2. Late Payment / IBM Factoring (D6)
    late_path = glob.glob(f"{staging_dir}/**/WA_Fn-UseC_-Accounts-Receivable.csv", recursive=True)
    if late_path:
        df_late = pd.read_csv(late_path[0])
        df_late.to_csv(f"{staging_dir}/late_payment.csv", index=False)
        print("Processed late_payment.csv")

    # 3. SaaS Subscriptions (D4)
    saas_acc_path = glob.glob(f"{staging_dir}/**/ravenstack_accounts.csv", recursive=True)
    saas_sub_path = glob.glob(f"{staging_dir}/**/ravenstack_subscriptions.csv", recursive=True)
    if saas_acc_path and saas_sub_path:
        df_acc = pd.read_csv(saas_acc_path[0])
        df_sub = pd.read_csv(saas_sub_path[0])
        df_saas = pd.merge(df_acc, df_sub, on="account_id", how="inner")
        
        df_saas["Customer_ID"] = [f"CUST-{i+1:04d}" for i in range(len(df_saas))]
        df_saas["Plan_Type"] = df_saas["plan_name"] if "plan_name" in df_saas.columns else "Professional"
        df_saas["Monthly_Price"] = df_saas["mrr"] if "mrr" in df_saas.columns else 20000
        
        created_col = df_saas["created_at_x"] if "created_at_x" in df_saas.columns else "2024-01-01"
        df_saas["Signup_Date"] = pd.Series(created_col).astype(str).str.slice(0, 10)
        df_saas["Status"] = "Active"
        
        df_saas.to_csv(f"{staging_dir}/saas.csv", index=False)
        print("Processed saas.csv")

    # 4. MSME Invoices & Companies (D7)
    msme_path = glob.glob(f"{staging_dir}/**/msme_invoices.csv", recursive=True)
    if msme_path:
        df_msme = pd.read_csv(msme_path[0])
        if "Company_Name" not in df_msme.columns:
            if "buyer_name" in df_msme.columns:
                df_msme["Company_Name"] = df_msme["buyer_name"]
            elif "seller_name" in df_msme.columns:
                df_msme["Company_Name"] = df_msme["seller_name"]
            else:
                df_msme["Company_Name"] = "MSME Corp " + df_msme.index.astype(str)
        if "Region" not in df_msme.columns:
            df_msme["Region"] = np.random.choice(["North", "South", "East", "West", "Central"], len(df_msme))
        df_msme.to_csv(f"{staging_dir}/msme.csv", index=False)
        print("Processed msme.csv")

    print("All staging archives processed successfully.")

if __name__ == "__main__":
    process_archives()
