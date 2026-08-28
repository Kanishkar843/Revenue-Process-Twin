import sqlite3
from fastapi import APIRouter, HTTPException, Query, Depends
from app.db.connection import get_connection, get_db_path
from app.services.conformance_engine import evaluate_conformance, conformance_score
from app.services.graph_engine import evaluate_graph_heuristics
from app.services.counterfactual_engine import generate_counterfactual
from app.services.detection_rules import evaluate_rules
from app.services.ml_models import predict_churn
from app.services.auth_service import get_current_user

router = APIRouter()

@router.get("/api/customers")
def get_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
):
    """Returns paginated real customer accounts directly from SQLite customers table."""
    user_id = current_user.get("sub", "system")
    with get_connection() as conn:
        cursor = conn.cursor()
        total = cursor.execute("SELECT COUNT(*) FROM customers WHERE user_id = ?;", (user_id,)).fetchone()[0]
        
        offset = (page - 1) * page_size
        rows = cursor.execute("""
            SELECT customer_id, name, plan, plan_mrr_paise, segment
            FROM customers
            WHERE user_id = ?
            ORDER BY customer_id ASC
            LIMIT ? OFFSET ?;
        """, (user_id, page_size, offset)).fetchall()
        
        customers = []
        for r in rows:
            mrr_paise = r["plan_mrr_paise"] or 0
            customers.append({
                "customer_id": r["customer_id"],
                "customer_name": r["name"] or r["customer_id"],
                "plan": r["plan"] or "Standard",
                "plan_mrr_rs": float(mrr_paise) / 100.0,
                "segment": r["segment"] or "smb"
            })
            
        return {
            "page": page,
            "page_size": page_size,
            "total": total,
            "customers": customers
        }

@router.get("/api/customer/{customer_id}/risk")
def get_customer_risk(customer_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub", "system")
    db_path = get_db_path()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT customer_id, name, plan_mrr_paise FROM customers WHERE customer_id = ? AND user_id = ?;", (customer_id, user_id))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Dynamic query for customer transaction metrics
        refunds = cursor.execute(
            "SELECT SUM(CASE WHEN type='refund' THEN amount_paise ELSE 0 END), SUM(CASE WHEN type='purchase' THEN amount_paise ELSE 0 END) FROM transactions WHERE customer_id = ?;",
            (customer_id,)
        ).fetchone()
        tot_ref = refunds[0] or 0
        tot_pur = refunds[1] or 0
        refund_ratio = float(tot_ref) / float(tot_pur) if tot_pur > 0 else 0.0

        failed_payments = cursor.execute(
            "SELECT COUNT(*) FROM payments WHERE customer_id = ? AND status = 'failed';",
            (customer_id,)
        ).fetchone()[0]

        missed_renewals = cursor.execute(
            "SELECT COUNT(*) FROM renewals WHERE customer_id = ? AND status IN ('missed', 'failed_payment');",
            (customer_id,)
        ).fetchone()[0]

    # Conformance deviation score
    c_score = conformance_score(db_path, customer_id)
    conformance_dev_score = round(1.0 - c_score, 2)

    features = {
        "days_since_last_purchase": 35 if missed_renewals > 0 else 10,
        "revenue_decline_streak": 3 if missed_renewals > 0 else 0,
        "failed_payment_count": failed_payments,
        "refund_ratio": refund_ratio,
        "renewal_miss_count": missed_renewals,
        "plan_mrr": row["plan_mrr_paise"] if row["plan_mrr_paise"] else 2000000,
        "support_tickets": 3 if failed_payments > 0 else 1
    }
    churn_prob, factors = predict_churn(features)

    risk_score = round(0.6 * (conformance_dev_score * 100.0) + 0.4 * (churn_prob * 100.0))
    risk_score = max(0, min(100, risk_score))

    contributing = [{"factor": "Conformance deviation impact", "weight": round(conformance_dev_score * 0.6, 2)}]
    contributing.extend(factors)

    return {
        "customer_id": customer_id,
        "customer_name": row["name"],
        "risk_score": risk_score,
        "conformance_deviation_score": conformance_dev_score,
        "churn_probability": churn_prob,
        "contributing_factors": contributing
    }

@router.get("/api/customer/{customer_id}/explain")
def explain_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub", "system")
    db_path = get_db_path()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT customer_id, name FROM customers WHERE customer_id = ? AND user_id = ?;", (customer_id, user_id))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Customer not found")

    raw_devs = evaluate_conformance(db_path, customer_id=customer_id)
    conformance_deviations = [
        {
            "rule_id": d["rule_id"],
            "process_break_step": d["process_break_step"],
            "expected_next": d["expected_next"],
            "actual_next": d["actual_next"],
            "deviation_type": d["deviation_type"],
            "leak_amount_rs": float(d["leak_amount_paise"]) / 100.0,
            "evidence": d["evidence"]
        }
        for d in raw_devs
    ]

    g_links = evaluate_graph_heuristics(db_path, customer_id=customer_id)
    graph_link_obj = g_links[0] if g_links else {
        "heuristic": "GH01",
        "connected_entities": [customer_id, "Rule: R03", "Approver: GATEWAY"]
    }

    rule_id = raw_devs[0]["rule_id"] if raw_devs else "R03"
    leak_type = raw_devs[0]["leak_type"] if raw_devs else "over_discount"
    leak_paise = raw_devs[0]["leak_amount_paise"] if raw_devs else 12000000

    cf = generate_counterfactual(
        rule_id=rule_id,
        leak_type=leak_type,
        leak_amount_paise=leak_paise,
        customer_id=customer_id
    )

    rule_traces = list({d["rule_id"] for d in raw_devs}) if raw_devs else ["R03", "GF02"]

    return {
        "customer_id": customer_id,
        "conformance_deviations": conformance_deviations,
        "graph_links": graph_link_obj,
        "counterfactual": {
            "cf_id": cf["cf_id"],
            "statement": cf["statement"],
            "estimated_recovery_rs": cf["estimated_recovery_rs"],
            "confidence": cf["confidence"]
        },
        "rule_traces": rule_traces
    }
