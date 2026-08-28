import pytest
import sqlite3
import os
import tempfile
from app.services.detection_rules import evaluate_rules
from app.services.conformance_engine import evaluate_conformance
from app.services.ml_models import predict_churn, predict_anomaly

@pytest.fixture
def test_db():
    db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    db_path = db_file.name
    db_file.close()

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create schema
    cursor.executescript("""
        CREATE TABLE customers (
            customer_id TEXT PRIMARY KEY,
            name TEXT,
            plan TEXT,
            plan_mrr_paise INTEGER,
            segment TEXT
        );

        CREATE TABLE invoices (
            invoice_id TEXT PRIMARY KEY,
            customer_id TEXT,
            amount_paise INTEGER,
            discount_pct REAL,
            issue_date TEXT,
            due_date TEXT,
            status TEXT,
            contract_ref TEXT
        );

        CREATE TABLE payments (
            payment_id TEXT PRIMARY KEY,
            invoice_id TEXT,
            customer_id TEXT,
            amount_paise INTEGER,
            payment_ts TEXT,
            status TEXT
        );

        CREATE TABLE transactions (
            txn_id TEXT PRIMARY KEY,
            customer_id TEXT,
            type TEXT,
            amount_paise INTEGER,
            txn_ts TEXT
        );

        CREATE TABLE renewals (
            renewal_id TEXT PRIMARY KEY,
            customer_id TEXT,
            due_date TEXT,
            status TEXT,
            attempt_count INTEGER
        );

        CREATE TABLE event_log (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_id TEXT,
            event_type TEXT,
            timestamp TEXT
        );
    """)

    # Seed signals for ALL 8 core leakage categories
    # 1. CUST-01: Invoice Overdue (R01/GF01)
    cursor.execute("INSERT INTO customers VALUES ('CUST-01', 'Overdue Corp', 'Enterprise', 500000, 'enterprise')")
    cursor.execute("INSERT INTO invoices VALUES ('INV-01', 'CUST-01', 500000, 0.0, '2025-06-01', '2025-06-30', 'issued', 'CTR-01')")

    # 2. CUST-02: Duplicate Payment (R02/GF05)
    cursor.execute("INSERT INTO customers VALUES ('CUST-02', 'DupPay Inc', 'Pro', 200000, 'smb')")
    cursor.execute("INSERT INTO invoices VALUES ('INV-02', 'CUST-02', 200000, 0.0, '2025-07-01', '2025-07-31', 'paid', 'CTR-02')")
    cursor.execute("INSERT INTO payments VALUES ('PAY-01', 'INV-02', 'CUST-02', 200000, '2025-07-05', 'success')")
    cursor.execute("INSERT INTO payments VALUES ('PAY-02', 'INV-02', 'CUST-02', 200000, '2025-07-05', 'success')")

    # 3. CUST-03: Over Discount (R03/GF02)
    cursor.execute("INSERT INTO customers VALUES ('CUST-03', 'Discount Ltd', 'Pro', 300000, 'smb')")
    cursor.execute("INSERT INTO invoices VALUES ('INV-03', 'CUST-03', 300000, 0.40, '2025-07-01', '2025-07-31', 'issued', 'CTR-03')")

    # 4. CUST-04: High Refund Ratio / Spurious Refund (R04/GF04)
    cursor.execute("INSERT INTO customers VALUES ('CUST-04', 'Refund Abuse LLC', 'Basic', 100000, 'smb')")
    cursor.execute("INSERT INTO transactions VALUES ('TXN-R1', 'CUST-04', 'refund', 80000, '2025-07-10')")

    # 5. CUST-05: Missed Renewal (R05/GF03)
    cursor.execute("INSERT INTO customers VALUES ('CUST-05', 'Renewal Miss Co', 'Enterprise', 1000000, 'enterprise')")
    cursor.execute("INSERT INTO renewals VALUES ('REN-01', 'CUST-05', '2025-07-01', 'missed', 0)")

    # 6. CUST-06: Contractless Enterprise Discount (R11/GF06)
    cursor.execute("INSERT INTO customers VALUES ('CUST-06', 'NoContract Corp', 'Enterprise', 500000, 'enterprise')")
    cursor.execute("INSERT INTO invoices VALUES ('INV-06', 'CUST-06', 500000, 0.30, '2025-07-01', '2025-07-31', 'issued', '')")

    # 7. CUST-07: Silent Churn (R09/GF08)
    cursor.execute("INSERT INTO customers VALUES ('CUST-07', 'Silent Churn Co', 'Pro', 400000, 'smb')")
    cursor.execute("INSERT INTO transactions VALUES ('TXN-07', 'CUST-07', 'purchase', 400000, '2025-05-01')")

    # 8. CUST-08: Duplicate Invoice (R08)
    cursor.execute("INSERT INTO customers VALUES ('CUST-08', 'DupInvoice Ltd', 'Basic', 150000, 'smb')")
    cursor.execute("INSERT INTO invoices VALUES ('INV-08A', 'CUST-08', 150000, 0.0, '2025-07-01', '2025-07-31', 'issued', 'CTR-08')")
    cursor.execute("INSERT INTO invoices VALUES ('INV-08B', 'CUST-08', 150000, 0.0, '2025-07-01', '2025-07-31', 'issued', 'CTR-08')")

    conn.commit()
    conn.close()

    yield db_path

    if os.path.exists(db_path):
        os.remove(db_path)

def test_multi_leakage_detection_coverage(test_db):
    rule_alerts = evaluate_rules(test_db)
    conf_alerts = evaluate_conformance(test_db)

    all_alerts = rule_alerts + conf_alerts
    leak_types = set(a["leak_type"] for a in all_alerts)

    print("Detected Leak Types in Multi-Leakage Test DB:", leak_types)

    # Verify coverage across core leakage categories
    expected_categories = {
        "invoice_overdue",
        "overdue_invoice",
        "duplicate_payment",
        "over_discount",
        "spurious_refund",
        "missed_renewal",
        "contractless_enterprise_discount",
        "silent_churn",
        "duplicate_invoice"
    }

    assert expected_categories.intersection(leak_types), "Engine should detect multiple distinct leakage categories"
    assert len(leak_types) >= 5, f"Expected at least 5 distinct leakage categories in test DB, got {len(leak_types)}"

def test_ml_models_inference():
    # Test Isolation Forest anomaly prediction
    anomaly_score = predict_anomaly(discount_z=4.5, latency=60.0, refund_ratio=0.5, amount_z=3.0)
    assert 0.0 <= anomaly_score <= 1.0

    # Test XGBoost Churn prediction
    sample_features = {
        "days_since_last_purchase": 90,
        "revenue_decline_streak": 3,
        "failed_payment_count": 2,
        "refund_ratio": 0.25,
        "renewal_miss_count": 1,
        "plan_mrr": 50000,
        "support_tickets": 4
    }
    prob, factors = predict_churn(sample_features)
    assert 0.0 <= prob <= 1.0
    assert isinstance(factors, list)
