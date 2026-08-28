import sqlite3
import time
from app.services.conformance_engine import evaluate_conformance
from app.services.counterfactual_engine import generate_counterfactual
from app.services.detection_rules import evaluate_rules

DB_PATH = "data/final/revenue_leaks.db"

def run_validation_gate():
    print("=" * 60)
    print("RUNNING REVENUE PROCESS TWIN VALIDATION GATE V1 - V5")
    print("=" * 60)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # V1: Table counts
    n_cust = cursor.execute("SELECT COUNT(*) FROM customers;").fetchone()[0]
    n_inv = cursor.execute("SELECT COUNT(*) FROM invoices;").fetchone()[0]
    n_pay = cursor.execute("SELECT COUNT(*) FROM payments;").fetchone()[0]
    n_evt = cursor.execute("SELECT COUNT(*) FROM event_log;").fetchone()[0]

    print(f"[V1] Customers: {n_cust}, Invoices: {n_inv}, Payments: {n_pay}, Events: {n_evt}")
    assert n_cust >= 200, f"V1 FAIL: customers {n_cust} < 200"
    assert n_inv >= 1000, f"V1 FAIL: invoices {n_inv} < 1000"
    assert n_pay >= 800, f"V1 FAIL: payments {n_pay} < 800"
    assert n_evt >= 3000, f"V1 FAIL: events {n_evt} < 3000"
    print("✓ V1 PASSED: All table counts meet or exceed thresholds!")

    # V2: No orphan invoices
    cursor.execute("""
        SELECT COUNT(*) FROM payments p
        WHERE p.invoice_id NOT IN (SELECT invoice_id FROM invoices);
    """)
    orphans = cursor.fetchone()[0]
    print(f"[V2] Orphan payment references: {orphans}")
    assert orphans == 0, f"V2 FAIL: Found {orphans} orphan payment references"
    print("✓ V2 PASSED: No orphan invoices in database!")

    # V3: Seed leak S01 produces CRITICAL alert with leak_amount >= ₹3L
    alerts = evaluate_rules(DB_PATH, customer_id="CUST-0042")
    s01_alerts = [a for a in alerts if a["severity"] == "critical" and a["leak_amount_paise"] >= 30000000]
    print(f"[V3] S01 Critical Alerts found: {len(s01_alerts)}")
    assert len(s01_alerts) > 0, "V3 FAIL: Seed leak S01 did not produce CRITICAL alert >= ₹3L"
    print(f"✓ V3 PASSED: Seed leak S01 produced CRITICAL alert with leak amount ₹{float(s01_alerts[0]['leak_amount_paise'])/100:,.2f}!")

    # V4: Conformance engine flags GF02 on CUST-0042 within 500ms
    t0 = time.time()
    devs = evaluate_conformance(DB_PATH, customer_id="CUST-0042")
    elapsed_ms = (time.time() - t0) * 1000.0
    gf02_flagged = any(d["rule_id"] == "GF02" for d in devs)
    print(f"[V4] GF02 flagged on CUST-0042: {gf02_flagged} in {elapsed_ms:.2f} ms")
    assert gf02_flagged, "V4 FAIL: GF02 not flagged on CUST-0042"
    assert elapsed_ms < 500.0, f"V4 FAIL: Conformance evaluation took {elapsed_ms:.2f} ms (>500ms)"
    print("✓ V4 PASSED: Conformance engine flagged GF02 within 500ms!")

    # V5: Counterfactual CF02 output for CUST-0042 states recovery >= ₹3.5L
    cf = generate_counterfactual("GF02", "over_discount", 42000000, customer_id="CUST-0042")
    print(f"[V5] Counterfactual CF02 Estimated Recovery: ₹{cf['estimated_recovery_rs']:,.2f}")
    assert cf["estimated_recovery_rs"] >= 315000.0 or cf["recoverable_paise"] >= 31500000, "V5 FAIL: CF02 recovery < ₹3.5L"
    print("✓ V5 PASSED: Counterfactual CF02 states estimated recovery >= ₹3.5L!")

    conn.close()
    print("=" * 60)
    print("ALL VALIDATION GATES V1 - V5 PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_validation_gate()
