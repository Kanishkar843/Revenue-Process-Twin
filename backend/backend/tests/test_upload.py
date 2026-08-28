import pytest
import io
import json
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_upload_csv():
    csv_content = b"customer_id,name,plan,plan_mrr_paise\nCUST-TEST1,Test Corp 1,Enterprise,1000000\n"
    response = client.post(
        "/api/upload",
        files={"file": ("test_data.csv", csv_content, "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["records_processed"] >= 1
    assert "customers" in data["tables_updated"]

def test_upload_json():
    json_data = [
        {"customer_id": "CUST-TEST2", "name": "Test Corp 2", "plan": "SMB", "plan_mrr_paise": 500000}
    ]
    json_content = json.dumps(json_data).encode("utf-8")
    response = client.post(
        "/api/upload",
        files={"file": ("test_data.json", json_content, "application/json")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["records_processed"] >= 1

def test_upload_empty_file():
    response = client.post(
        "/api/upload",
        files={"file": ("empty.csv", b"", "text/csv")}
    )
    assert response.status_code == 400
