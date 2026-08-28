from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

# 1. Alert Schemas
class AlertItem(BaseModel):
    alert_id: str
    customer_id: str
    customer_name: str
    rule_id: str
    leak_type: str
    severity: str
    leak_amount_rs: float
    recoverable_rs: float
    process_break_step: Optional[str] = None
    expected_next: Optional[str] = None
    actual_next: Optional[str] = None
    recommended_action: str
    status: str = "open"
    created_at: str

class AlertsResponse(BaseModel):
    page: int
    page_size: int
    total: int
    alerts: List[AlertItem]

# 2. Risk Schemas
class ContributingFactor(BaseModel):
    factor: str
    weight: float

class CustomerRiskResponse(BaseModel):
    customer_id: str
    risk_score: int = Field(ge=0, le=100)
    conformance_deviation_score: float
    churn_probability: float
    contributing_factors: List[ContributingFactor]

# 3. Explain Schemas
class ConformanceDeviation(BaseModel):
    rule_id: str
    process_break_step: str
    expected_next: str
    actual_next: str
    deviation_type: str
    leak_amount_rs: float
    evidence: str

class GraphLinks(BaseModel):
    heuristic: str
    connected_entities: List[str]

class Counterfactual(BaseModel):
    cf_id: str
    statement: str
    estimated_recovery_rs: float
    confidence: float

class CustomerExplainResponse(BaseModel):
    customer_id: str
    conformance_deviations: List[ConformanceDeviation]
    graph_links: Dict[str, Any]
    counterfactual: Counterfactual
    rule_traces: List[str]

# 4. Summary Schemas
class LeakTypeSummary(BaseModel):
    leak_type: str
    leakage_rs: float
    recoverable_rs: float
    count: int

class RecoverableSummaryResponse(BaseModel):
    total_leakage_rs: float
    total_recoverable_rs: float
    active_alerts: int
    avg_risk_score: int
    by_leak_type: List[LeakTypeSummary]

# 5. Chat Schemas
class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    answer: str
    leak_amount_rs: float
    process_break: str
    connected_entities: List[str]
    recommended_action: str
    recovery_estimate_rs: float

# 6. Action Execution Schemas
class ActionExecuteRequest(BaseModel):
    alert_id: str
    action: str
    actor: str = "user"

class ActionExecuteResponse(BaseModel):
    status: str
    audit_log_id: int
    executed_at: str

# 7. Health Schemas
class HealthResponse(BaseModel):
    status: str
    db: str
    model_loaded: bool
    narrator_mode: str

# 8. Data Upload Schemas
class DataUploadResponse(BaseModel):
    filename: str
    file_type: str
    records_processed: int
    tables_updated: List[str]
    status: str
    message: str
