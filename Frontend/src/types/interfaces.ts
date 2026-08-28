// Revenue Guard — Frozen API Contract Types
// Source: SYSTEM_DESIGN_v2_Revenue_Process_Twin.docx + Build-Handoff.md
// Money fields suffixed _rs are already in rupees (integer). Never use float for money.

export type Severity = "critical" | "high" | "medium" | "low";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface AlertRecord {
  alert_id: string;
  customer_id: string;
  customer_name: string;
  rule_id: string;                 // R01-R11 | GF01-GF08 | GH01-GH05
  leak_type: string;
  severity: Severity;
  leak_amount_rs: number;
  recoverable_rs: number;
  process_break_step: string | null;
  expected_next: string | null;
  actual_next: string | null;
  recommended_action: string;
  status: AlertStatus;
  created_at: string;              // ISO-8601
}

export interface AlertsResponse {
  page: number;
  page_size: number;
  total: number;
  alerts: AlertRecord[];
}

export interface ContributingFactor {
  factor: string;
  weight: number; // 0-1
}

export interface CustomerRisk {
  customer_id: string;
  customer_name?: string;
  risk_score: number;              // 0-100
  conformance_deviation_score: number; // 0-1
  churn_probability: number;       // 0-1
  contributing_factors: ContributingFactor[];
}

export interface ConformanceDeviation {
  rule_id: string;
  process_break_step: string;
  expected_next: string | null;
  actual_next: string;
  deviation_type: string;
  leak_amount_rs: number;
  evidence: string;
}

export interface GraphLinks {
  heuristic: string;                // GH01-GH05
  connected_entities: string[];
}

export interface CounterfactualAction {
  cf_id: string;
  statement: string;
  estimated_recovery_rs: number;
  confidence: number;               // 0-1
}

export interface CustomerExplain {
  customer_id: string;
  conformance_deviations: ConformanceDeviation[];
  graph_links: GraphLinks;
  counterfactual: CounterfactualAction;
  rule_traces: string[];
}

export interface LeakTypeBreakdown {
  leak_type: string;
  leakage_rs: number;
  recoverable_rs: number;
  count: number;
}

export interface SeverityBreakdown {
  severity: Severity;
  leakage_rs: number;
  recoverable_rs: number;
  count: number;
}

export interface TrendPoint {
  date: string;                     // ISO date
  leakage_rs: number;
  recoverable_rs: number;
}

export interface RecoverableSummary {
  total_leakage_rs: number;
  total_recoverable_rs: number;
  active_alerts: number;
  avg_risk_score: number;
  by_leak_type: LeakTypeBreakdown[];
  by_severity: SeverityBreakdown[];
  trend_30d: TrendPoint[];
}

export interface ChatRequest {
  query: string;
}

export interface ChatResponse {
  answer: string;
  narrative?: string;
  mode?: string;
  evidence?: any;
  leak_amount_rs: number;
  process_break: string;
  connected_entities: string[];
  recommended_action: string;
  recovery_estimate_rs: number;
}

export interface ActionExecuteRequest {
  alert_id?: string;
  customer_id?: string;
  action: string;
  actor?: "user" | "system";
}

export interface ActionExecuteResponse {
  status: "success" | "failed";
  audit_log_id: number;
  executed_at: string;
}

export interface AuditLogEntry {
  log_id: number;
  alert_id: string;
  action_type: string;
  actor: "user" | "system" | "agent";
  outcome: string;
  executed_at: string;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  db: "connected" | "disconnected";
  model_loaded: boolean;
  narrator_mode: "live" | "mock";
}

// ── Data Ingestion ─────────────────────────────────────────────
export type UploadFileType = ".xlsx" | ".xls" | ".csv" | ".json" | ".zip";

export interface DataUploadResponse {
  filename: string;
  file_type: UploadFileType;
  records_processed: number;
  tables_updated: string[];
  status: "success" | "error";
  message: string;
}

export interface UploadHistoryEntry {
  id: string;
  file: File;
  response: DataUploadResponse;
  uploadedAt: string;
}
