import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Download } from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { SeverityBadge, StatusBadge } from "../components/shared/SeverityBadge";
import { MoneyValue } from "../components/shared/MoneyValue";
import { SkeletonCard, ErrorState, EmptyState } from "../components/shared/LoadingSpinner";
import { useAlerts } from "../hooks/useAlerts";
import { formatDate } from "../lib/format";
import { getFadeUp, staggerContainer, EASE } from "../lib/motion";
import { exportAlertsCsv, exportAlertsPdf } from "../api/apiClient";
import ReactECharts from "echarts-for-react";

const SEVERITY_OPTIONS = ["all", "critical", "high", "medium", "low"] as const;
const STATUS_OPTIONS = ["all", "open", "acknowledged", "resolved"] as const;
const LEAK_TYPES = ["all", "over_discount", "duplicate_payment", "silent_churn",
  "contract_less_discount", "refund_abuse", "overdue_invoice", "chargeback_pattern", "missed_invoice"] as const;

const SEVERITY_CHIP_CLASSES: Record<string, string> = {
  all: "bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)]",
  critical: "bg-[var(--color-severity-critical-bg)] text-[var(--color-severity-critical-text)] border border-[var(--color-severity-critical-dot)]",
  high: "bg-[var(--color-severity-high-bg)] text-[var(--color-severity-high-text)] border border-[var(--color-severity-high-dot)]",
  medium: "bg-[var(--color-severity-medium-bg)] text-[var(--color-severity-medium-text)] border border-[var(--color-border)]",
  low: "bg-[var(--color-severity-low-bg)] text-[var(--color-severity-low-text)] border border-[var(--color-border)]",
};

function FilterChip({
  label,
  active,
  onClick,
  chipClass,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  chipClass?: string;
}) {
  return (
    <motion.button
      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 ${active
        ? (chipClass ?? "bg-[var(--color-black)] text-white border border-transparent")
        : "bg-white text-[var(--color-muted)] border border-[var(--color-border)] hover:text-[var(--color-text)]"
        }`}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
    >
      {label.replace(/_/g, " ")}
    </motion.button>
  );
}

/** Mini stacked bar of alert counts by severity for the current filtered set */
function SeverityMiniBar({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  if (!total) return null;

  const option = {
    animation: true,
    animationDuration: 300,
    animationEasing: "cubicOut",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#fff",
      borderColor: "#e5e5e5",
      borderWidth: 1,
      textStyle: { color: "#1a1a1a", fontSize: 11 },
    },
    grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: true },
    xAxis: { type: "value", show: false, max: total },
    yAxis: { type: "category", data: ["Alerts"], show: false },
    series: [
      {
        name: "Critical", type: "bar", stack: "s", data: [counts.critical ?? 0], barMaxWidth: 20,
        itemStyle: { color: "#c0152f" }, emphasis: { disabled: true }
      },
      {
        name: "High", type: "bar", stack: "s", data: [counts.high ?? 0], barMaxWidth: 20,
        itemStyle: { color: "#b8862e" }, emphasis: { disabled: true }
      },
      {
        name: "Medium", type: "bar", stack: "s", data: [counts.medium ?? 0], barMaxWidth: 20,
        itemStyle: { color: "#8a8a8a" }, emphasis: { disabled: true }
      },
      {
        name: "Low", type: "bar", stack: "s", data: [counts.low ?? 0], barMaxWidth: 20,
        itemStyle: { color: "#c9c9c9", borderRadius: [0, 3, 3, 0] }, emphasis: { disabled: true }
      },
    ],
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--color-muted)] whitespace-nowrap">Severity split</span>
      <div style={{ width: 200, height: 20 }}>
        <ReactECharts option={option} style={{ height: 20, width: 200 }} notMerge />
      </div>
      <span className="text-[10px] text-[var(--color-muted)]">{total} alerts</span>
    </div>
  );
}

export default function Alerts() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useAlerts();
  const fadeUp = getFadeUp();

  const [severity, setSeverity] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [leakType, setLeakType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(format);
    setExportError(null);
    try {
      const filterParams = { severity, status, leak_type: leakType, search };
      if (format === "csv") {
        await exportAlertsCsv(filterParams);
      } else {
        await exportAlertsPdf(filterParams);
      }
    } catch (err: any) {
      setExportError(err.message || "Unable to generate export. Please try again.");
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setExporting(null);
    }
  };

  const alerts = data?.alerts ?? [];

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (severity !== "all" && a.severity !== severity) return false;
      if (status !== "all" && a.status !== status) return false;
      if (leakType !== "all" && a.leak_type !== leakType) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.customer_name.toLowerCase().includes(q) ||
          a.alert_id.toLowerCase().includes(q) ||
          a.leak_type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [alerts, severity, status, leakType, search]);

  // Severity counts for mini bar
  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const a of filtered) counts[a.severity] = (counts[a.severity] ?? 0) + 1;
    return counts;
  }, [filtered]);

  return (
    <PageShell title="Alerts">
      <motion.div
        className="flex flex-col gap-4"
        variants={staggerContainer(0.05)}
        initial="initial"
        animate="animate"
      >
        {/* Filter bar */}
        <motion.div variants={fadeUp} className="card p-4 flex flex-col gap-3">
          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-64">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                id="alerts-search"
                className="input-base w-full pl-8"
                placeholder="Search customer or alert ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <SeverityMiniBar counts={severityCounts} />
          </div>

          {/* Severity chips */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-micro mr-1 self-center">Severity</span>
            {SEVERITY_OPTIONS.map(s => (
              <FilterChip
                key={s}
                label={s === "all" ? "All" : s}
                active={severity === s}
                onClick={() => setSeverity(s)}
                chipClass={s !== "all" ? (SEVERITY_CHIP_CLASSES[s] + (severity === s ? " !border-2" : "")) : undefined}
              />
            ))}
          </div>

          {/* Status + leak type chips */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-micro mr-1 self-center">Status</span>
            {STATUS_OPTIONS.map(s => (
              <FilterChip key={s} label={s === "all" ? "All" : s} active={status === s} onClick={() => setStatus(s)} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-micro mr-1 self-center">Type</span>
            {LEAK_TYPES.map(t => (
              <FilterChip key={t} label={t === "all" ? "All" : t} active={leakType === t} onClick={() => setLeakType(t)} />
            ))}
          </div>
        </motion.div>

        {/* Table */}
        <motion.div variants={fadeUp} className="card overflow-hidden">
          {exportError && (
            <div className="p-3 bg-red-950 text-red-300 text-xs font-semibold flex items-center justify-between">
              <span>{exportError}</span>
              <button onClick={() => setExportError(null)} className="text-red-400 hover:text-white">✕</button>
            </div>
          )}
          <div className="px-5 py-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
            <span className="text-h3 text-[var(--color-ink)]">
              {filtered.length} alert{filtered.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              {filtered.length !== alerts.length && (
                <button className="btn-ghost text-xs" onClick={() => { setSeverity("all"); setStatus("all"); setLeakType("all"); setSearch(""); }}>
                  Clear filters
                </button>
              )}
              <button
                onClick={() => handleExport("csv")}
                disabled={exporting !== null}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-2xs text-[var(--color-ink)]"
              >
                <Download size={13} />
                {exporting === "csv" ? "Exporting CSV..." : "Export CSV"}
              </button>
              <button
                onClick={() => handleExport("pdf")}
                disabled={exporting !== null}
                className="px-3 py-1.5 text-xs font-semibold bg-[var(--color-ink)] text-white rounded-lg hover:bg-black transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Download size={13} />
                {exporting === "pdf" ? "Generating PDF..." : "Export PDF"}
              </button>
            </div>
          </div>

          {isLoading && <div className="p-6"><SkeletonCard rows={5} /></div>}
          {!isLoading && error && <ErrorState message="Failed to load alerts." />}
          {!isLoading && !error && filtered.length === 0 && (
            <EmptyState message="No alerts match the current filters." />
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="overflow-x-auto" data-lenis-prevent>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Alert</th>
                    <th>Customer</th>
                    <th>Leak Type</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th className="text-right">Leakage</th>
                    <th className="text-right">Recoverable</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <AnimatePresence mode="popLayout">
                  <tbody>
                    {filtered.map(alert => (
                      <motion.tr
                        key={alert.alert_id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18, ease: EASE }}
                        onClick={() => navigate(`/customer/${alert.customer_id}`)}
                        tabIndex={0}
                        onKeyDown={e => e.key === "Enter" && navigate(`/customer/${alert.customer_id}`)}
                      >
                        <td>
                          <code className="text-xs font-mono text-[var(--color-muted)]">
                            {alert.alert_id}
                          </code>
                        </td>
                        <td className="font-medium">{alert.customer_name}</td>
                        <td className="text-[var(--color-text-secondary)] text-xs">
                          {alert.leak_type.replace(/_/g, " ")}
                        </td>
                        <td>
                          <SeverityBadge severity={alert.severity as "critical" | "high" | "medium" | "low"} />
                        </td>
                        <td>
                          <StatusBadge status={alert.status as "open" | "acknowledged" | "resolved"} />
                        </td>
                        <td className="text-right">
                          <MoneyValue value={alert.leak_amount_rs} />
                        </td>
                        <td className="text-right">
                          <MoneyValue value={alert.recoverable_rs} accent />
                        </td>
                        <td className="text-[var(--color-muted)] text-xs whitespace-nowrap">
                          {formatDate(alert.created_at)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </AnimatePresence>
              </table>
            </div>
          )}
        </motion.div>
      </motion.div>
    </PageShell>
  );
}
