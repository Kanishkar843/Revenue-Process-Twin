import pytest
from app.services.counterfactual_engine import calculate_recoverable_paise, generate_counterfactual, RECOVERY_PROBABILITIES

def test_recovery_probabilities_exact():
    assert RECOVERY_PROBABILITIES["duplicate_payment"] == 1.00
    assert RECOVERY_PROBABILITIES["over_discount"] == 0.75
    assert RECOVERY_PROBABILITIES["contractless_enterprise_discount"] == 0.70
    assert RECOVERY_PROBABILITIES["failed_renewal_recovery_gap"] == 0.61
    assert RECOVERY_PROBABILITIES["missed_renewal"] == 0.40
    assert RECOVERY_PROBABILITIES["overdue_invoice"] == 0.33
    assert RECOVERY_PROBABILITIES["silent_churn"] == 0.25

def test_calculate_recoverable_paise_integer():
    rec = calculate_recoverable_paise("over_discount", 42000000)
    assert isinstance(rec, int)
    assert rec == 31500000  # 42,000,000 * 0.75 = 31,500,000 paise

def test_generate_counterfactual_acme():
    cf = generate_counterfactual("GF02", "over_discount", 42000000, "CUST-0042")
    assert cf["cf_id"] == "CF02"
    assert cf["confidence"] == 0.75
    assert cf["estimated_recovery_rs"] >= 315000.0
