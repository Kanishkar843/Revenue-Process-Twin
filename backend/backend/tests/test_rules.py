import pytest
from app.db.connection import get_db_path
from app.services.detection_rules import evaluate_rules

def test_evaluate_rules_all():
    db_path = get_db_path()
    alerts = evaluate_rules(db_path)
    assert isinstance(alerts, list)
    assert len(alerts) > 0

def test_rule_r03_seed_acme():
    db_path = get_db_path()
    alerts = evaluate_rules(db_path, customer_id="CUST-0042")
    rule_ids = [a["rule_id"] for a in alerts]
    assert "R03" in rule_ids

def test_rule_r02_seed_vertex():
    db_path = get_db_path()
    alerts = evaluate_rules(db_path, customer_id="CUST-0108")
    rule_ids = [a["rule_id"] for a in alerts]
    assert "R02" in rule_ids

def test_rule_r09_seed_neon():
    db_path = get_db_path()
    alerts = evaluate_rules(db_path, customer_id="CUST-0077")
    rule_ids = [a["rule_id"] for a in alerts]
    assert "R09" in rule_ids

def test_rule_r11_seed_bluestar():
    db_path = get_db_path()
    alerts = evaluate_rules(db_path, customer_id="CUST-0031")
    rule_ids = [a["rule_id"] for a in alerts]
    assert "R11" in rule_ids
