import sqlite3
from fastapi import APIRouter, Depends
from app.db.connection import get_connection, get_db_path
from app.services.conformance_engine import evaluate_conformance
from app.services.auth_service import get_current_user

router = APIRouter()

@router.get("/api/processes")
def get_process_health(current_user: dict = Depends(get_current_user)):
    """Returns real process twin health metrics derived from SQLite database and conformance engine."""
    user_id = current_user["sub"]
    db_path = get_db_path()
    raw_devs = evaluate_conformance(db_path, user_id=user_id)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        total_txns = cursor.execute("SELECT COUNT(*) FROM transactions WHERE user_id = ?;", (user_id,)).fetchone()[0]
        total_inv_vol = float(cursor.execute("SELECT COALESCE(SUM(amount_paise), 0) FROM invoices WHERE user_id = ?;", (user_id,)).fetchone()[0]) / 100.0
        total_txn_vol = float(cursor.execute("SELECT COALESCE(SUM(amount_paise), 0) FROM transactions WHERE user_id = ?;", (user_id,)).fetchone()[0]) / 100.0
        total_ren_vol = float(cursor.execute("SELECT COALESCE(SUM(plan_mrr_paise * 12), 0) FROM customers WHERE user_id = ?;", (user_id,)).fetchone()[0]) / 100.0
        
        # Categorize violations by rule
        r_counts = {}
        r_leakage = {}
        for d in raw_devs:
            rid = d["rule_id"]
            leak_p = d["leak_amount_paise"]
            r_counts[rid] = r_counts.get(rid, 0) + 1
            r_leakage[rid] = r_leakage.get(rid, 0) + leak_p

    proc01_leak = float(r_leakage.get("GF02", 0)) / 100.0
    proc01_cnt = r_counts.get("GF02", 0)

    proc02_leak = float(r_leakage.get("GF01", 0) + r_leakage.get("GF05", 0)) / 100.0
    proc02_cnt = r_counts.get("GF01", 0) + r_counts.get("GF05", 0)

    proc03_leak = float(r_leakage.get("GF03", 0) + r_leakage.get("GF07", 0)) / 100.0
    proc03_cnt = r_counts.get("GF03", 0) + r_counts.get("GF07", 0)

    proc04_leak = float(r_leakage.get("GF04", 0)) / 100.0
    proc04_cnt = r_counts.get("GF04", 0)

    processes = [
        {
            "id": "PROC-01",
            "name": "Discount Approval Conformance",
            "category": "Pricing & Contracts",
            "healthScore": max(0, 100 - min(100, proc01_cnt * 10)),
            "totalVolumeRs": total_inv_vol * 0.25 if total_inv_vol > 0 else 0.0,
            "exposedLeakageRs": proc01_leak,
            "violationsCount": proc01_cnt,
            "expectedFlow": "Applied → Approved → Invoice Issued",
            "actualFlow": "Applied → Invoice Issued (Approval Bypassed)",
            "status": "critical" if proc01_cnt > 5 else ("warning" if proc01_cnt > 0 else "healthy")
        },
        {
            "id": "PROC-02",
            "name": "Invoice to Payment Settlement",
            "category": "Billing & Collections",
            "healthScore": max(0, 100 - min(100, proc02_cnt * 5)),
            "totalVolumeRs": total_inv_vol,
            "exposedLeakageRs": proc02_leak,
            "violationsCount": proc02_cnt,
            "expectedFlow": "Invoice Issued → Payment Received → Settled",
            "actualFlow": "Invoice Issued → Payment Overdue / SLA Breach",
            "status": "critical" if proc02_cnt > 5 else ("warning" if proc02_cnt > 0 else "healthy")
        },
        {
            "id": "PROC-03",
            "name": "Contract Renewal Conformance",
            "category": "Subscriptions",
            "healthScore": max(0, 100 - min(100, proc03_cnt * 10)),
            "totalVolumeRs": total_ren_vol,
            "exposedLeakageRs": proc03_leak,
            "violationsCount": proc03_cnt,
            "expectedFlow": "30-Day Notice → Price Indexing → Executed Renewal",
            "actualFlow": "Expired → Lapsed without Notice → Silent Churn Risk",
            "status": "warning" if proc03_cnt > 0 else "healthy"
        },
        {
            "id": "PROC-04",
            "name": "Refund & Credit Note Authorization",
            "category": "Adjustments",
            "healthScore": max(0, 100 - min(100, proc04_cnt * 10)),
            "totalVolumeRs": total_txn_vol * 0.1 if total_txn_vol > 0 else 0.0,
            "exposedLeakageRs": proc04_leak,
            "violationsCount": proc04_cnt,
            "expectedFlow": "Ticket Filed → Supervisor Review → Credit Memo",
            "actualFlow": "Ticket Filed → Spurious Refund Triggered",
            "status": "warning" if proc04_cnt > 0 else "healthy"
        }
    ]

    total_violations = len(raw_devs)
    total_exposed_rs = sum(float(d["leak_amount_paise"]) for d in raw_devs) / 100.0
    avg_health = round(sum(p["healthScore"] for p in processes) / len(processes))

    return {
        "avg_health_score": avg_health,
        "total_violations": total_violations,
        "total_transactions_monitored": total_txns,
        "exposed_revenue_at_risk_rs": total_exposed_rs,
        "processes": processes
    }
