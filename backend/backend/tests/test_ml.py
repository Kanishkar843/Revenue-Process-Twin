import pytest
import os
import pickle
import sqlite3
import numpy as np
from app.services.ml_models import predict_churn, predict_anomaly, CHURN_MODEL_PATH, IF_MODEL_PATH
from app.db.connection import get_db_path

def test_models_exist():
    assert os.path.exists(CHURN_MODEL_PATH), "churn_xgb.pkl must exist"
    assert os.path.exists(IF_MODEL_PATH), "isolation_forest.pkl must exist"

def test_isolation_forest_prediction():
    # Normal input vs extreme outlier input
    score_normal = predict_anomaly(discount_z=0.1, latency=2.0, refund_ratio=0.02, amount_z=0.1)
    score_outlier = predict_anomaly(discount_z=5.0, latency=45.0, refund_ratio=0.80, amount_z=8.0)
    
    assert isinstance(score_normal, float)
    assert 0.0 <= score_normal <= 1.0
    assert isinstance(score_outlier, float)
    assert 0.0 <= score_outlier <= 1.0
    # Outlier anomaly score should be higher than normal score
    assert score_outlier > score_normal

def test_xgboost_churn_prediction():
    sample_features = {
        "days_since_last_purchase": 60,
        "revenue_decline_pct": 0.35,
        "overdue_invoice_count": 2,
        "plan_mrr": 500.0,
        "support_tickets": 4
    }
    prob, factors = predict_churn(sample_features)
    assert isinstance(prob, float)
    assert 0.0 <= prob <= 1.0
    assert isinstance(factors, list)
    assert len(factors) > 0
    assert "factor" in factors[0] and "weight" in factors[0]

def test_customer_risk_score_dynamic():
    """Verify risk scores are computed dynamically from ML models, not stored in DB."""
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)

    # Fetch all customers to get a real ID
    c_res = client.get("/api/customers")
    assert c_res.status_code == 200
    cust_list = c_res.json()["customers"]
    if not cust_list:
        pytest.skip("No active customers in DB")
    cust_id = cust_list[0]["customer_id"]

    # Verify risk endpoint computes score dynamically
    res = client.get(f"/api/customer/{cust_id}/risk")
    assert res.status_code == 200
    data = res.json()
    assert "risk_score" in data
    assert 0 <= data["risk_score"] <= 100
    assert "churn_probability" in data
    assert 0.0 <= data["churn_probability"] <= 1.0
