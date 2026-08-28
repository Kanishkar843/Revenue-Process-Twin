import os
import pickle
import pandas as pd
import numpy as np
import xgboost as xgb
import shap

def train_churn_model():
    print("Training XGBoost Churn Model...")
    os.makedirs("ml/models", exist_ok=True)

    df = pd.read_csv("data/staging/telco_churn.csv")
    
    feature_cols = [
        "days_since_last_purchase",
        "revenue_decline_streak",
        "failed_payment_count",
        "refund_ratio",
        "renewal_miss_count",
        "plan_mrr",
        "support_tickets"
    ]
    
    X = df[feature_cols]
    y = (df["Churn"] == "Yes").astype(int)

    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.05,
        random_state=42
    )
    model.fit(X, y)

    # Initialize SHAP TreeExplainer
    explainer = shap.TreeExplainer(model)

    with open("ml/models/churn_xgb.pkl", "wb") as f:
        pickle.dump({"model": model, "feature_cols": feature_cols, "explainer": explainer}, f)

    print("XGBoost Churn Model & SHAP Explainer trained and saved to ml/models/churn_xgb.pkl")

if __name__ == "__main__":
    train_churn_model()
