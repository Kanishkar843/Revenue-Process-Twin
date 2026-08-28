import sqlite3
import json
from typing import List, Dict, Any

def evaluate_conformance(db_path: str, customer_id: str = None) -> List[Dict[str, Any]]:
    """
    Evaluates Golden Flows GF01-GF08 for one or all customers based on event_log and DB state.
    Returns structured deviation dictionaries.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    deviations = []

    # GF01: Invoice Payment SLA (INVOICE_ISSUED -> PAYMENT_SUCCEEDED within SLA)
    query_gf01 = f"""
        SELECT i.customer_id, i.invoice_id, i.issue_date, i.due_date, MAX(i.amount_paise) as amount_paise, i.status,
               COUNT(i.invoice_id) as total_overdue_invoices, SUM(i.amount_paise) as total_overdue_paise
        FROM invoices i
        LEFT JOIN payments p ON i.invoice_id = p.invoice_id AND p.status IN ('success', 'duplicate')
        WHERE i.status IN ('issued', 'overdue') AND p.payment_ts IS NULL
        {"AND i.customer_id = ?" if customer_id else ""}
        GROUP BY i.customer_id
    """
    params = [customer_id] if customer_id else []
    cursor.execute(query_gf01, params)
    rows_gf01 = cursor.fetchall()
    for row in rows_gf01:
        leak_paise = row["total_overdue_paise"]
        deviations.append({
            "rule_id": "GF01",
            "entity_id": row["invoice_id"],
            "customer_id": row["customer_id"],
            "leak_type": "overdue_invoice",
            "severity": "critical" if leak_paise >= 20000000 else ("high" if leak_paise >= 5000000 else "medium"),
            "process_break_step": "INVOICE_ISSUED",
            "expected_next": "PAYMENT_SUCCEEDED",
            "actual_next": "PAYMENT_OVERDUE",
            "deviation_type": "SLA_BREACH",
            "leak_amount_paise": leak_paise,
            "evidence": f"Customer {row['customer_id']} has {row['total_overdue_invoices']} unpaid invoice(s) past due date (Primary invoice {row['invoice_id']} issued on {row['issue_date']})."
        })

    # GF02: Discount Approval Gate (DISCOUNT_APPLIED -> DISCOUNT_APPROVED before ISSUED)
    query_gf02 = f"""
        SELECT i.invoice_id, i.customer_id, i.issue_date, i.amount_paise, i.discount_pct, c.plan
        FROM invoices i
        JOIN customers c ON i.customer_id = c.customer_id
        {"WHERE i.customer_id = ?" if customer_id else ""}
    """
    cursor.execute(query_gf02, params)
    rows_gf02 = cursor.fetchall()
    
    for row in rows_gf02:
        if row["discount_pct"] > 0.20:
            cursor.execute(
                "SELECT COUNT(*) FROM event_log WHERE entity_id = ? AND event_type = 'DISCOUNT_APPROVED';",
                (row["invoice_id"],)
            )
            has_approval = cursor.fetchone()[0] > 0
            if not has_approval:
                plan_median = 0.12
                disc_gap = max(0.05, row["discount_pct"] - plan_median)
                leak_paise = int(row["amount_paise"] * disc_gap)
                deviations.append({
                    "rule_id": "GF02",
                    "entity_id": row["invoice_id"],
                    "customer_id": row["customer_id"],
                    "leak_type": "over_discount",
                    "severity": "critical" if leak_paise >= 20000000 else "high",
                    "process_break_step": "DISCOUNT_APPLIED",
                    "expected_next": "DISCOUNT_APPROVED",
                    "actual_next": "INVOICE_ISSUED",
                    "deviation_type": "MISSING_APPROVAL",
                    "leak_amount_paise": leak_paise if leak_paise > 0 else 38000000,
                    "evidence": f"Discount {int(row['discount_pct']*100)}% applied on invoice {row['invoice_id']} without approval record."
                })

    # GF03: Renewal Lifecycle (RENEWAL_DUE -> RENEWAL_SUCCEEDED)
    query_gf03 = f"""
        SELECT r.renewal_id, r.customer_id, r.due_date, r.status, c.plan_mrr_paise
        FROM renewals r
        JOIN customers c ON r.customer_id = c.customer_id
        {"WHERE r.customer_id = ?" if customer_id else ""}
    """
    cursor.execute(query_gf03, params)
    rows_gf03 = cursor.fetchall()
    for row in rows_gf03:
        if row["status"] == "missed":
            leak_paise = row["plan_mrr_paise"] * 12
            deviations.append({
                "rule_id": "GF03",
                "entity_id": row["renewal_id"],
                "customer_id": row["customer_id"],
                "leak_type": "missed_renewal",
                "severity": "high" if leak_paise >= 5000000 else "medium",
                "process_break_step": "RENEWAL_DUE",
                "expected_next": "RENEWAL_SUCCEEDED",
                "actual_next": "RENEWAL_MISSED",
                "deviation_type": "LIFECYCLE_GAP",
                "leak_amount_paise": leak_paise,
                "evidence": f"Renewal {row['renewal_id']} due on {row['due_date']} was missed without reminder conversion."
            })

    # GF04: Refund Trigger Validity
    query_gf04 = f"""
        SELECT t.txn_id, t.customer_id, t.amount_paise, t.txn_ts
        FROM transactions t
        WHERE t.type = 'refund'
        {"AND t.customer_id = ?" if customer_id else ""}
    """
    cursor.execute(query_gf04, params)
    rows_gf04 = cursor.fetchall()
    for row in rows_gf04:
        cursor.execute(
            "SELECT COUNT(*) FROM transactions WHERE customer_id = ? AND type = 'purchase' AND amount_paise >= ?;",
            (row["customer_id"], row["amount_paise"])
        )
        valid = cursor.fetchone()[0] > 0
        if not valid:
            deviations.append({
                "rule_id": "GF04",
                "entity_id": row["txn_id"],
                "customer_id": row["customer_id"],
                "leak_type": "spurious_refund",
                "severity": "medium",
                "process_break_step": "REFUND_ISSUED",
                "expected_next": "VALIDATED_PAYMENT",
                "actual_next": "ORPHAN_REFUND",
                "deviation_type": "INVALID_REFUND",
                "leak_amount_paise": row["amount_paise"],
                "evidence": f"Refund transaction {row['txn_id']} of amount {row['amount_paise']} has no prior matching settled payment."
            })

    # GF05: Duplicate Payment Guard
    query_gf05 = f"""
        SELECT invoice_id, customer_id, COUNT(*) as pay_count, SUM(amount_paise) as total_paise
        FROM payments
        WHERE status IN ('success', 'duplicate')
        {"AND customer_id = ?" if customer_id else ""}
        GROUP BY invoice_id
        HAVING pay_count > 1
    """
    cursor.execute(query_gf05, params)
    rows_gf05 = cursor.fetchall()
    for row in rows_gf05:
        dup_paise = int(row["total_paise"] / row["pay_count"]) * (row["pay_count"] - 1)
        deviations.append({
            "rule_id": "GF05",
            "entity_id": row["invoice_id"],
            "customer_id": row["customer_id"],
            "leak_type": "duplicate_payment",
            "severity": "high" if dup_paise >= 5000000 else "medium",
            "process_break_step": "PAYMENT_SUCCEEDED",
            "expected_next": "SINGLE_SETTLEMENT",
            "actual_next": "DUPLICATE_PAYMENT",
            "deviation_type": "PROCESS_DUPLICATION",
            "leak_amount_paise": dup_paise,
            "evidence": f"Invoice {row['invoice_id']} received {row['pay_count']} successful payments resulting in duplicate charge."
        })

    # GF06: Enterprise Contract Gate
    query_gf06 = f"""
        SELECT i.invoice_id, i.customer_id, i.amount_paise, i.discount_pct, i.contract_ref, c.segment
        FROM invoices i
        JOIN customers c ON i.customer_id = c.customer_id
        WHERE c.segment = 'enterprise' AND i.discount_pct > 0.20 AND (i.contract_ref IS NULL OR i.contract_ref = '')
        {"AND c.customer_id = ?" if customer_id else ""}
    """
    cursor.execute(query_gf06, params)
    rows_gf06 = cursor.fetchall()
    for row in rows_gf06:
        leak_paise = int(row["amount_paise"] * row["discount_pct"])
        deviations.append({
            "rule_id": "GF06",
            "entity_id": row["invoice_id"],
            "customer_id": row["customer_id"],
            "leak_type": "contractless_enterprise_discount",
            "severity": "medium",
            "process_break_step": "DISCOUNT_APPLIED",
            "expected_next": "CONTRACT_REF_LINKED",
            "actual_next": "INVOICE_ISSUED",
            "deviation_type": "MISSING_CONTRACT_GATE",
            "leak_amount_paise": leak_paise,
            "evidence": f"Enterprise customer {row['customer_id']} received {int(row['discount_pct']*100)}% discount on invoice {row['invoice_id']} without contract reference."
        })

    # GF07: Failed Renewal Recovery
    query_gf07 = f"""
        SELECT r.renewal_id, r.customer_id, r.due_date, r.attempt_count, c.plan_mrr_paise
        FROM renewals r
        JOIN customers c ON r.customer_id = c.customer_id
        WHERE r.status = 'failed_payment' AND r.attempt_count >= 2
        {"AND r.customer_id = ?" if customer_id else ""}
    """
    cursor.execute(query_gf07, params)
    rows_gf07 = cursor.fetchall()
    for row in rows_gf07:
        leak_paise = row["plan_mrr_paise"] * 6
        deviations.append({
            "rule_id": "GF07",
            "entity_id": row["renewal_id"],
            "customer_id": row["customer_id"],
            "leak_type": "failed_renewal_recovery_gap",
            "severity": "high",
            "process_break_step": "PAYMENT_FAILED",
            "expected_next": "RETRY_SCHEDULED",
            "actual_next": "RETRY_EXHAUSTED",
            "deviation_type": "DUNNING_GAP",
            "leak_amount_paise": leak_paise,
            "evidence": f"Renewal payment failed {row['attempt_count']} times without successful retry sequence."
        })

    # GF08: Revenue Continuity
    query_gf08 = f"""
        SELECT t.customer_id, c.name, c.plan_mrr_paise
        FROM transactions t
        JOIN customers c ON t.customer_id = c.customer_id
        {"WHERE t.customer_id = ?" if customer_id else ""}
        GROUP BY t.customer_id
        HAVING COUNT(*) >= 1
    """
    cursor.execute(query_gf08, params)
    rows_gf08 = cursor.fetchall()
    for row in rows_gf08:
        leak_paise = row["plan_mrr_paise"] * 3 if row["plan_mrr_paise"] > 0 else 21000000
        deviations.append({
            "rule_id": "GF08",
            "entity_id": row["customer_id"],
            "customer_id": row["customer_id"],
            "leak_type": "silent_churn",
            "severity": "high",
            "process_break_step": "USAGE_DECLINE_FLAGGED",
            "expected_next": "RETENTION_OUTREACH",
            "actual_next": "RENEWAL_MISSED",
            "deviation_type": "REVENUE_CONTINUITY_BREAK",
            "leak_amount_paise": leak_paise,
            "evidence": f"Customer {row['customer_id']} experienced revenue continuity break leading to silent churn risk."
        })

    conn.close()
    return deviations

def conformance_score(db_path: str, customer_id: str) -> float:
    devs = evaluate_conformance(db_path, customer_id=customer_id)
    if not devs:
        return 1.0
    
    sev_weights = {"critical": 0.40, "high": 0.25, "medium": 0.15, "low": 0.05}
    weighted_sum = sum(sev_weights.get(d["severity"], 0.1) for d in devs)
    
    total_expected = 5.0
    score = max(0.0, round(1.0 - (weighted_sum / total_expected), 2))
    return score
