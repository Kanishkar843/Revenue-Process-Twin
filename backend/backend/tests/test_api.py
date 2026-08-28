import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["db"] == "connected"

def test_api_alerts():
    res = client.get("/api/alerts?page=1&page_size=25")
    assert res.status_code == 200
    data = res.json()
    assert "alerts" in data
    assert "total" in data
    assert data["total"] > 0
    first = data["alerts"][0]
    assert "leak_amount_rs" in first
    assert "recoverable_rs" in first

def test_api_customer_risk():
    c_res = client.get("/api/customers")
    assert c_res.status_code == 200
    cust_list = c_res.json()["customers"]
    if not cust_list:
        pytest.skip("No active customers in DB")
    cust_id = cust_list[0]["customer_id"]

    res = client.get(f"/api/customer/{cust_id}/risk")
    assert res.status_code == 200
    data = res.json()
    assert data["customer_id"] == cust_id
    assert "risk_score" in data
    assert "conformance_deviation_score" in data
    assert "churn_probability" in data

def test_api_customer_explain():
    c_res = client.get("/api/customers")
    assert c_res.status_code == 200
    cust_list = c_res.json()["customers"]
    if not cust_list:
        pytest.skip("No active customers in DB")
    cust_id = cust_list[0]["customer_id"]

    res = client.get(f"/api/customer/{cust_id}/explain")
    assert res.status_code == 200
    data = res.json()
    assert data["customer_id"] == cust_id
    assert "conformance_deviations" in data
    assert "graph_links" in data
    assert "counterfactual" in data
    assert "rule_traces" in data

def test_api_recoverable_summary():
    res = client.get("/api/recoverable-summary")
    assert res.status_code == 200
    data = res.json()
    assert "total_leakage_rs" in data
    assert "total_recoverable_rs" in data
    assert "by_leak_type" in data

def test_api_chat():
    res = client.post("/api/chat", json={"query": "Why is customer losing revenue?"})
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert "leak_amount_rs" in data
    assert "recommended_action" in data

def test_api_actions_execute():
    a_res = client.get("/api/alerts")
    assert a_res.status_code == 200
    alerts_list = a_res.json()["alerts"]
    alert_id = alerts_list[0]["alert_id"] if alerts_list else "ALT-0001"

    res = client.post("/api/actions/execute", json={"alert_id": alert_id, "action": "mark_re_invoiced", "actor": "user"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "audit_log_id" in data
