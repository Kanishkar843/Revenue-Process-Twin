import pytest
from app.services.graph_engine import evaluate_graph_heuristics

DB_PATH = "data/final/revenue_leaks.db"

def test_graph_heuristics_all():
    heuristics = evaluate_graph_heuristics(DB_PATH)
    assert isinstance(heuristics, list)
    assert len(heuristics) > 0

def test_gh01_acme():
    heuristics = evaluate_graph_heuristics(DB_PATH, customer_id="CUST-0042")
    h_ids = [h["heuristic"] for h in heuristics]
    assert "GH01" in h_ids

def test_gh03_vertex():
    heuristics = evaluate_graph_heuristics(DB_PATH, customer_id="CUST-0108")
    h_ids = [h["heuristic"] for h in heuristics]
    assert "GH03" in h_ids
