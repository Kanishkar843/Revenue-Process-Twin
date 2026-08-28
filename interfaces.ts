export interface AlertRecord {
    alert_id: string;
    customer_id: string;
    customer_name: string;
    rule_id: string;               // R01-R11 | GF01-GF08 | GH01-GH05
    leak_type: string;
    severity: "critical" | "high" | "medium" | "low";
    leak_amount_rs: number;
    recoverable_rs: number;
    process_break_step: string | null;
    expected_next: string | null;
    actual_next: string | null;
    recommended_action: string;
    status: "open" | "acknowledged" | "resolved";
    created_at: string;
}

export interface CustomerRisk {
    customer_id: string;
    risk_score: number; // 0-100
    conformance_deviation_score: number;
    churn_probability: number;
    contributing_factors: { factor: string; weight: number }[];
}

export interface CounterfactualAction {
    cf_id: string;
    statement: string;
    estimated_recovery_rs: number;
    confidence: number;
}

export interface ChatResponse {
    answer: string;
    leak_amount_rs: number;
    process_break: string;
    connected_entities: string[];
    recommended_action: string;
    recovery_estimate_rs: number;
}
