import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_dataset_switch_pipeline():
    """Verify that uploading Dataset B replaces Dataset A state completely."""
    # 1. Ingest Dataset A
    csv_a = (
        "customer_id,customer_name,plan,segment,invoice_id,billed_amount,due_date,status\n"
        "CUST-A1,Alpha Corp,Enterprise,enterprise,INV-A1,10000.0,2026-01-01,issued\n"
        "CUST-A2,Beta LLC,Professional,smb,INV-A2,5000.0,2026-01-15,issued\n"
    )
    res_a = client.post(
        "/api/upload",
        files={"file": ("dataset_a.csv", io.BytesIO(csv_a.encode("utf-8")), "text/csv")}
    )
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["status"] == "success"

    # Verify active customers in DB are CUST-A1 and CUST-A2
    custs_a = client.get("/api/customers").json()["customers"]
    c_ids_a = [c["customer_id"] for c in custs_a]
    assert "CUST-A1" in c_ids_a
    assert "CUST-A2" in c_ids_a

    # 2. Ingest Dataset B
    csv_b = (
        "customer_id,customer_name,plan,segment,invoice_id,billed_amount,due_date,status\n"
        "CUST-B1,Gamma Inc,Enterprise,enterprise,INV-B1,25000.0,2026-02-01,issued\n"
    )
    res_b = client.post(
        "/api/upload",
        files={"file": ("dataset_b.csv", io.BytesIO(csv_b.encode("utf-8")), "text/csv")}
    )
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["status"] == "success"

    # Verify active customers in DB are ONLY CUST-B1, and CUST-A1 is purged
    custs_b = client.get("/api/customers").json()["customers"]
    c_ids_b = [c["customer_id"] for c in custs_b]
    assert "CUST-B1" in c_ids_b
    assert "CUST-A1" not in c_ids_b
    assert "CUST-A2" not in c_ids_b

def test_zero_record_dataset_rejected():
    """Verify that ingesting a dataset with 0 data rows is correctly rejected."""
    csv_zero = "customer_id,customer_name,plan,segment,invoice_id,billed_amount,due_date,status\n"
    res = client.post(
        "/api/upload",
        files={"file": ("empty_dataset.csv", io.BytesIO(csv_zero.encode("utf-8")), "text/csv")}
    )
    # Backend correctly rejects empty datasets
    assert res.status_code == 400

def test_clean_dataset_zero_leakage():
    """Verify that a dataset with no anomalies produces zero leakage metrics."""
    # Upload a minimal clean dataset that triggers no detection rules
    csv_clean = (
        "customer_id,customer_name,plan,segment,invoice_id,billed_amount,discount_pct,due_date,status\n"
        "CUST-CLEAN1,Clean Corp,Enterprise,enterprise,INV-CLEAN1,10000.0,0.05,2026-12-31,paid\n"
    )
    res = client.post(
        "/api/upload",
        files={"file": ("clean_dataset.csv", io.BytesIO(csv_clean.encode("utf-8")), "text/csv")}
    )
    assert res.status_code == 200

    # Summary should show zero leakage since no rules should fire
    summary = client.get("/api/recoverable-summary").json()
    assert summary["total_leakage_rs"] == 0.0
    assert summary["total_recoverable_rs"] == 0.0
    assert summary["active_alerts"] == 0

    for t in summary["trend_30d"]:
        assert t["leakage_rs"] == 0.0
        assert t["recoverable_rs"] == 0.0
