import pytest
from app.db.connection import get_db_path
from app.services.conformance_engine import evaluate_conformance, conformance_score

def test_evaluate_conformance_all():
    db_path = get_db_path()
    devs = evaluate_conformance(db_path)
    assert isinstance(devs, list)
    assert len(devs) > 0

def test_gf02_acme():
    db_path = get_db_path()
    devs = evaluate_conformance(db_path, customer_id="CUST-0042")
    rule_ids = [d["rule_id"] for d in devs]
    assert "GF02" in rule_ids

def test_gf05_vertex():
    db_path = get_db_path()
    devs = evaluate_conformance(db_path, customer_id="CUST-0108")
    rule_ids = [d["rule_id"] for d in devs]
    assert "GF05" in rule_ids

def test_gf08_neon():
    db_path = get_db_path()
    devs = evaluate_conformance(db_path, customer_id="CUST-0077")
    rule_ids = [d["rule_id"] for d in devs]
    assert "GF08" in rule_ids

def test_conformance_score():
    db_path = get_db_path()
    score = conformance_score(db_path, "CUST-0042")
    assert 0.0 <= score <= 1.0
