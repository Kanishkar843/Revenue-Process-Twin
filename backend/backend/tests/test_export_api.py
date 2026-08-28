import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(autouse=True)
def ensure_sample_data():
    c_res = client.get("/api/alerts")
    if c_res.status_code != 200 or c_res.json().get("total", 0) == 0:
        csv_sample = (
            "customer_id,customer_name,plan,segment,invoice_id,billed_amount,discount_pct,due_date,status,payment_id,paid_amount,payment_status\n"
            "CUST-0042,Acme Corp,Enterprise,enterprise,INV-10042,42000.0,0.35,2025-01-01,issued,PAY-1,42000.0,duplicate\n"
            "CUST-0042,Acme Corp,Enterprise,enterprise,INV-10042,42000.0,0.35,2025-01-01,issued,PAY-2,42000.0,duplicate\n"
            "CUST-0043,Globex Inc,Professional,smb,INV-10043,15000.0,0.25,2025-01-15,overdue,,0,unpaid\n"
        )
        client.post(
            "/api/upload",
            files={"file": ("sample_seed.csv", io.BytesIO(csv_sample.encode("utf-8")), "text/csv")}
        )

def test_export_alerts_csv():
    res = client.get("/api/export/alerts/csv")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=" in res.headers["content-disposition"]
    content = res.text
    assert "Alert ID" in content
    assert "Customer ID" in content
    assert "Customer Name" in content

def test_export_alerts_csv_filtered():
    res = client.get("/api/export/alerts/csv?severity=critical")
    assert res.status_code in (200, 404)
    if res.status_code == 200:
        assert res.headers["content-type"].startswith("text/csv")
        assert "CRITICAL" in res.text or "critical" in res.text or "Alert ID" in res.text

def test_export_alerts_pdf():
    res = client.get("/api/export/alerts/pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in res.headers["content-disposition"]
    assert res.content.startswith(b"%PDF")

def test_export_recovery_csv():
    res = client.get("/api/export/recovery/csv")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert "Recovery Case ID" in res.text

def test_export_recovery_pdf():
    res = client.get("/api/export/recovery/pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")

def test_export_reports_pdf():
    res = client.get("/api/export/reports/pdf?report_id=REP-BOARD")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")

def test_export_reports_csv():
    res = client.get("/api/export/reports/csv?report_id=REP-BOARD")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert "Alert ID" in res.text

def test_export_audit_csv():
    res = client.get("/api/export/audit/csv")
    assert res.status_code in (200, 404)
    if res.status_code == 200:
        assert res.headers["content-type"].startswith("text/csv")

def test_export_audit_pdf():
    res = client.get("/api/export/audit/pdf")
    assert res.status_code in (200, 404)
    if res.status_code == 200:
        assert res.headers["content-type"] == "application/pdf"
        assert res.content.startswith(b"%PDF")
