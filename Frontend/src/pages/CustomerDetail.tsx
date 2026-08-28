import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  GitBranch,
  ShieldCheck,
  AlertTriangle,
  History,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { useCustomerRisk } from "../hooks/useCustomerRisk";
import { useCustomerExplain } from "../hooks/useCustomerExplain";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { SeverityBadge } from "../components/shared/SeverityBadge";
import { ContributingFactorsChart } from "../components/charts/ContributingFactorsChart";
import { NetworkGraphChart } from "../components/charts/NetworkGraphChart";
import { postExecuteAction } from "../api/apiClient";
import { formatINRShort, formatDateTime } from "../lib/format";

export default function CustomerDetail({ onAuditAppend }: { onAuditAppend?: (entry: any) => void } = {}) {
  const { id = "CUST-0042" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: risk, isLoading: rLoading, isError: rError } = useCustomerRisk(id);
  const { data: explain, isLoading: eLoading, isError: eError } = useCustomerExplain(id);

  const [approving, setApproving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [executedAction, setExecutedAction] = useState<any>(null);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleApproveAction() {
    if (!explain?.counterfactual) return;
    setApproving(true);
    try {
      const result = await postExecuteAction({
        action: explain.counterfactual.cf_id,
        customer_id: id,
      });
      if (result.status === "success") {
        showToast("Recovery action executed and logged to audit ledger.", "success");
        const actionObj = {
          alert_id: `ALT-${id}`,
          action_type: explain.counterfactual.cf_id,
          actor: "user",
          outcome: "success",
          executed_at: result.executed_at,
        };
        setExecutedAction(actionObj);
        onAuditAppend?.(actionObj);
      }
    } catch {
      showToast("Failed to execute action.", "error");
    } finally {
      setApproving(false);
    }
  }


  const isLoading = rLoading || eLoading;
  const hasError = rError || eError;

  return (
    <PageShell title={risk?.customer_name ? `Customer 360 - ${risk.customer_name}` : "Customer 360"}>
      <button className="btn-ghost mb-5 flex items-center gap-2 text-xs" onClick={() => navigate("/alerts")}>
        <ArrowLeft size={13} /> Back to Alerts
      </button>

      {toast && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold mb-4 flex items-center justify-between shadow-sm transition-all ${toast.type === "success"
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
            : "bg-red-50 text-red-800 border border-red-200"
            }`}
        >
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600">×</button>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center items-center py-20">
          <LoadingSpinner />
        </div>
      )}

      {hasError && !isLoading && (
        <div className="card p-8 text-center text-red-600">
          <p className="font-semibold text-sm">Failed to load customer profile for {id}.</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">Please verify the customer ID exists in the database.</p>
        </div>
      )}

      {!isLoading && !hasError && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)] flex items-center justify-center font-bold text-lg">
                <Building2 size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-[var(--color-ink)]">
                    {risk?.customer_name ?? id}
                  </h1>
                  <span className="badge font-mono text-[10px]">{id}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] mt-1">
                  <span>Enterprise Tier</span>
                  <span>•</span>
                  <span>North America Region</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-[var(--color-border)] pt-4 md:pt-0 md:pl-6">
              <div>
                <div className="text-micro text-[var(--color-muted)]">Risk Score</div>
                <div className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                  {risk?.risk_score ?? 0}
                  <span className="text-xs font-normal text-gray-400">/ 100</span>
                </div>
              </div>
              <div>
                <div className="text-micro text-[var(--color-muted)]">Dev. Score</div>
                <div className="text-2xl font-bold text-[var(--color-accent)]">
                  {risk?.conformance_deviation_score ?? 0}
                </div>
              </div>
              <div>
                <div className="text-micro text-[var(--color-muted)]">Churn Prob.</div>
                <div className="text-2xl font-bold text-amber-600">
                  {Math.round((risk?.churn_probability ?? 0) * 100)}%
                </div>
              </div>
            </div>
          </div>

          {/* Grid of details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Contributing factors & ML graph */}
            <div className="lg:col-span-2 space-y-6">
              {/* Factors Card */}
              <div className="card p-5">
                <h3 className="text-sm font-bold text-[var(--color-ink)] mb-4 flex items-center gap-2">
                  <Layers size={16} className="text-[var(--color-accent)]" />
                  Contributing Risk Factors (SHAP Weights)
                </h3>
                {risk?.contributing_factors && risk.contributing_factors.length > 0 ? (
                  <ContributingFactorsChart data={risk.contributing_factors} />
                ) : (
                  <p className="text-xs text-[var(--color-muted)]">No active risk factors identified.</p>
                )}
              </div>

              {/* Conformance Deviations Timeline */}
              <div className="card p-5">
                <h3 className="text-sm font-bold text-[var(--color-ink)] mb-4 flex items-center gap-2">
                  <GitBranch size={16} className="text-emerald-600" />
                  Process Conformance Deviations
                </h3>
                <div className="space-y-3">
                  {explain?.conformance_deviations?.map((dev: any, i: number) => (
                    <div key={i} className="p-3.5 rounded-lg bg-gray-50 border border-[var(--color-border)] text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-[var(--color-ink)]">{dev.process_break_step}</span>
                        <span className="font-bold text-red-600">
                          {formatINRShort(dev.leak_amount_rs)} at risk
                        </span>
                      </div>
                      <div className="text-gray-500 mb-2">{dev.evidence}</div>
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Expected: {dev.expected_next}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-800">
                          Actual: {dev.actual_next}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connected Entity Graph */}
              {explain?.graph_links && (
                <div className="card p-5">
                  <h3 className="text-sm font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-500" />
                    Connected Entity Heuristic Graph ({explain.graph_links.heuristic})
                  </h3>
                  <NetworkGraphChart
                    heuristic={explain.graph_links.heuristic}
                    entities={explain.graph_links.connected_entities}
                    customerId={id}
                  />
                </div>
              )}
            </div>

            {/* Right Col: Counterfactual & Action */}
            <div className="space-y-6">
              {/* Counterfactual Card */}
              {explain?.counterfactual && (
                <div className="card p-5 bg-gradient-to-br from-white to-purple-50/40 border-[var(--color-accent)]/20 shadow-md">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider mb-2">
                    <ShieldCheck size={16} />
                    Counterfactual Recovery Simulation
                  </div>
                  <h4 className="text-base font-bold text-[var(--color-ink)] mb-2">
                    {explain.counterfactual.statement}
                  </h4>
                  <p className="text-xs text-[var(--color-muted)] leading-relaxed mb-4">
                    The deterministic recovery engine estimates that executing this playbook will prevent immediate process leakage.
                  </p>

                  <div className="p-3 bg-white/80 backdrop-blur-sm rounded-lg border border-purple-100 mb-5">
                    <div className="text-micro text-gray-500">Estimated Recovery</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {formatINRShort(explain.counterfactual.estimated_recovery_rs)}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Confidence: {Math.round(explain.counterfactual.confidence * 100)}%
                    </div>
                  </div>

                  <button
                    onClick={handleApproveAction}
                    disabled={approving}
                    className="w-full py-3 px-4 rounded-xl bg-[var(--color-ink)] hover:bg-black text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {approving ? <LoadingSpinner size={14} /> : <CheckCircle size={14} />}
                    Approve Recovery Action
                  </button>
                </div>
              )}

              {/* Executed Action Audit Receipt */}
              {executedAction && (
                <div className="card p-4 bg-emerald-50 border-emerald-200 text-xs">
                  <div className="font-bold text-emerald-950 flex items-center gap-1.5 mb-1">
                    <CheckCircle size={14} className="text-emerald-600" />
                    Audit Entry Logged
                  </div>
                  <div className="text-emerald-800 text-[11px] font-mono mb-2">
                    Alert: {executedAction.alert_id}
                  </div>
                  <div className="text-gray-500 text-[10px]">
                    Executed: {formatDateTime(executedAction.executed_at)}
                  </div>
                </div>
              )}

              {/* Rule Traces */}
              <div className="card p-5">
                <h4 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <History size={14} className="text-gray-400" />
                  Active Rule Traces
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {explain?.rule_traces?.map((rt: string) => (
                    <span key={rt} className="px-2.5 py-1 rounded bg-gray-100 font-mono text-[11px] text-gray-700 font-semibold">
                      {rt}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
