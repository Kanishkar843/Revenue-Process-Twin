import math
from typing import Dict, Any

# Recovery probability matrix (exact per prompt specification)
RECOVERY_PROBABILITIES = {
    "duplicate_payment": 1.00,
    "over_discount": 0.75,
    "contractless_enterprise_discount": 0.70,
    "failed_renewal_payment": 0.61,
    "failed_renewal_recovery_gap": 0.61,
    "refund_excess": 0.50,
    "spurious_refund": 0.50,
    "high_refund_ratio": 0.50,
    "missed_renewal": 0.40,
    "overdue_invoice": 0.33,
    "invoice_overdue": 0.33,
    "silent_churn": 0.25,
    "revenue_decline": 0.25
}

CF_TEMPLATES = {
    "CF01": {
        "rule_id": "R01",
        "golden_flow": "GF01",
        "statement": "If invoice reissued with payment reminder within 5 days of overdue date -> collection probability increases by 33%.",
        "action": "Reissue invoice with automated reminder escalation"
    },
    "CF02": {
        "rule_id": "R03",
        "golden_flow": "GF02",
        "statement": "If discount normalized from 68% to 12% plan median -> invoice amount increases by ₹3.8L.",
        "action": "Normalize discount to plan median (12%)"
    },
    "CF03": {
        "rule_id": "R05",
        "golden_flow": "GF03",
        "statement": "If automated renewal reminder sent 14 days before due date -> renewal conversion probability increases to 82%.",
        "action": "Schedule 14-day pre-renewal automated reminder sequence"
    },
    "CF04": {
        "rule_id": "R04",
        "golden_flow": "GF04",
        "statement": "If refund threshold policy (>15% lifetime) is enforced -> unvalidated refund total is blocked.",
        "action": "Enforce strict refund threshold approval gate"
    },
    "CF05": {
        "rule_id": "R02",
        "golden_flow": "GF05",
        "statement": "If duplicate-payment guard active at payment processor -> second duplicate transaction automatically refunded.",
        "action": "Process duplicate payment refund / credit adjustment"
    },
    "CF06": {
        "rule_id": "R11",
        "golden_flow": "GF06",
        "statement": "If CONTRACT_REF gate enforced before invoice generation -> unapproved enterprise discount prevented.",
        "action": "Require valid contract reference before discount application"
    },
    "CF07": {
        "rule_id": "R06",
        "golden_flow": "GF07",
        "statement": "If failed renewal payment retried within 3 days (max 3 attempts) -> recovery probability is 61%.",
        "action": "Retry payment via alternate dunning channel within 3 days"
    },
    "CF08": {
        "rule_id": "R09",
        "golden_flow": "GF08",
        "statement": "If executive retention outreach triggered after 2nd consecutive decline month -> churn probability reduced by 25%.",
        "action": "Initiate immediate executive retention outreach"
    }
}

def calculate_recoverable_paise(leak_type: str, leak_amount_paise: int) -> int:
    """
    recoverable_paise(alert) = round(leak_amount_paise * recovery_probability(leak_type))
    Always integer paise.
    """
    prob = RECOVERY_PROBABILITIES.get(leak_type, 0.50)
    return int(round(leak_amount_paise * prob))

def generate_counterfactual(rule_id: str, leak_type: str, leak_amount_paise: int, customer_id: str = None) -> Dict[str, Any]:
    """Generates counterfactual intervention payload for an alert."""
    prob = RECOVERY_PROBABILITIES.get(leak_type, 0.50)
    recoverable_paise = calculate_recoverable_paise(leak_type, leak_amount_paise)
    
    # Map rule_id / leak_type to CF template
    cf_id = "CF02" if rule_id in ("R03", "GF02") else (
        "CF05" if rule_id in ("R02", "GF05") else (
            "CF08" if rule_id in ("R09", "GF08") else (
                "CF06" if rule_id in ("R11", "GF06") else "CF01"
            )
        )
    )
    
    template = CF_TEMPLATES.get(cf_id, CF_TEMPLATES["CF01"])
    
    statement = template["statement"]
    if cf_id == "CF02" and leak_amount_paise > 0:
        disc_gap_rs = round(float(recoverable_paise) / 100.0, 1)
        statement = f"If discount normalized to plan median (12%) -> recoverable amount increases by ₹{disc_gap_rs:,.0f}."
    
    recoverable_rs = float(recoverable_paise) / 100.0

    return {
        "cf_id": cf_id,
        "statement": statement,
        "estimated_recovery_rs": recoverable_rs,
        "recoverable_paise": recoverable_paise,
        "confidence": prob,
        "recommended_action": template["action"]
    }
