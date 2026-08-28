import os
import pickle
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHURN_MODEL_PATH = os.path.join(BASE_DIR, "ml", "models", "churn_xgb.pkl")
IF_MODEL_PATH = os.path.join(BASE_DIR, "ml", "models", "isolation_forest.pkl")

_churn_data = None
_if_data = None

def _load_models():
    global _churn_data, _if_data
    if _churn_data is None and os.path.exists(CHURN_MODEL_PATH):
        with open(CHURN_MODEL_PATH, "rb") as f:
            _churn_data = pickle.load(f)
            
    if _if_data is None and os.path.exists(IF_MODEL_PATH):
        with open(IF_MODEL_PATH, "rb") as f:
            _if_data = pickle.load(f)

def predict_churn(customer_features: Dict[str, Any]) -> Tuple[float, list]:
    """
    Predicts churn probability [0.0, 1.0] and top contributing SHAP features.
    """
    _load_models()
    if _churn_data is None:
        # Fallback heuristic if pickle not found
        return 0.35, [{"factor": "Baseline model risk", "weight": 0.35}]
        
    model = _churn_data["model"]
    feature_cols = _churn_data["feature_cols"]
    explainer = _churn_data["explainer"]

    row_data = [customer_features.get(col, 0) for col in feature_cols]
    df_row = pd.DataFrame([row_data], columns=feature_cols)

    prob = float(model.predict_proba(df_row)[0][1])

    # Calculate SHAP values
    shap_vals = explainer(df_row)
    vals = shap_vals.values[0]

    factors = []
    top_indices = np.argsort(np.abs(vals))[::-1][:3]
    for idx in top_indices:
        feat_name = feature_cols[idx].replace("_", " ").title()
        val = float(vals[idx])
        factors.append({"factor": f"{feat_name} impact", "weight": round(abs(val), 2)})

    return round(prob, 2), factors

def predict_anomaly(discount_z: float, latency: float, refund_ratio: float, amount_z: float) -> float:
    """Predicts anomaly score [0.0, 1.0] using Isolation Forest."""
    _load_models()
    if _if_data is None:
        return 0.15
        
    model = _if_data["model"]
    scaler = _if_data["scaler"]

    X = np.array([[discount_z, latency, refund_ratio, amount_z]])
    X_scaled = scaler.transform(X)
    score = -float(model.score_samples(X_scaled)[0])
    return round(min(1.0, max(0.0, score)), 2)
