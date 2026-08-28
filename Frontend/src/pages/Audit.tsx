import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { EmptyState } from "../components/shared/LoadingSpinner";
import { useAuditLog } from "../hooks/useAuditLog";
import { formatDateTime, formatLabel } from "../lib/format";
import { getFadeUp, staggerContainer } from "../lib/motion";
import { exportAuditCsv, exportAuditPdf, getAuditLog } from "../api/apiClient";
import type { AuditLogEntry } from "../types/interfaces";
import ReactECharts from "echarts-for-react";

interface Props {
  extraEntries?: AuditLogEntry[];
}

export default function Audit({ extraEntries = [] }: Props) {
  const { log: seedLog } = useAuditLog();
  const [dbEntries, setDbEntries] = useState<AuditLogEntry[]>([]);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    getAuditLog()
      .then((data) => {
        if (data?.entries && Array.isArray(data.entries)) {
          setDbEntries(data.entries);
        }
      })
      .catch(() => { });
  }, []);

  const log = [...extraEntries, ...dbEntries, ...seedLog];
  const fadeUp = getFadeUp();

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(format);
    setExportError(null);
    try {
      if (format === "csv") {
        await exportAuditCsv();
      } else {
        await exportAuditPdf();
      }
    } catch (err: any) {
      setExportError(err.message || "Export failed.");
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setExporting(null);
    }
  };

  // Aggregate by action_type for bar chart
  const actionCounts: Record<string, { success: number; failed: number }> = {};
  for (const e of log) {
    if (!actionCounts[e.action_type]) actionCounts[e.action_type] = { success: 0, failed: 0 };
    if (e.outcome === "success") actionCounts[e.action_type].success++;
    else actionCounts[e.action_type].failed++;
  }
  const actionTypes = Object.keys(actionCounts);

  const auditChartOption = {
    animation: true,
    animationDuration: 600,
    animationEasing: "cubicOut",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#fff",
      borderColor: "#e5e5e5",
      borderWidth: 1,
      textStyle: { color: "#1a1a1a", fontSize: 12 },
    },
    grid: { left: 0, right: 12, top: 4, bottom: 0, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { fontSize: 10, color: "#8a8a8a" },
      splitLine: { lineStyle: { color: "#f0f0f0" } },
    },
    yAxis: {
      type: "category",
      data: actionTypes.map(t => formatLabel(t)),
      axisLabel: { fontSize: 10, color: "#555" },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        name: "Success",
        type: "bar",
        stack: "total",
        data: actionTypes.map(t => actionCounts[t].success),
        itemStyle: { color: "#4dab89", borderRadius: [0, 0, 0, 0] },
        barMaxWidth: 14,
      },
      {
        name: "Failed",
        type: "bar",
        stack: "total",
        data: actionTypes.map(t => actionCounts[t].failed),
        itemStyle: { color: "#c0152f", borderRadius: [0, 3, 3, 0] },
        barMaxWidth: 14,
      },
    ],
  };

  return (
    <PageShell title="Actions & Audit Log">
      <motion.div
        className="flex flex-col gap-4"
        variants={staggerContainer(0.06)}
        initial="initial"
        animate="animate"
      >
        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Actions", value: log.length, accent: false },
            { label: "Successful", value: log.filter(l => l.outcome === "success").length, accent: true },
            { label: "User-initiated", value: log.filter(l => l.actor === "user").length, accent: false },
          ].map(({ label, value, accent }) => (
            <motion.div key={label} variants={fadeUp} className="card-kpi p-4 text-center">
              <div className={`text-2xl font-bold tabular font-display ${accent ? "text-[var(--color-accent)]" : "text-[var(--color-ink)]"}`}>
                {value}
              </div>
              <div className="text-xs text-[var(--color-muted)] mt-1">{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Outcomes chart */}
        {actionTypes.length > 0 && (
          <motion.div variants={fadeUp} className="card p-5">
            <h2 className="text-h3 text-[var(--color-ink)] mb-4">Outcomes by Action Type</h2>
            <ReactECharts
              option={auditChartOption}
              style={{ height: `${Math.max(100, actionTypes.length * 36)}px`, width: "100%" }}
              notMerge
            />
          </motion.div>
        )}

        {/* Table */}
        <motion.div variants={fadeUp} className="card overflow-x-auto">
          {exportError && (
            <div className="p-3 bg-red-950 text-red-300 text-xs font-semibold flex items-center justify-between">
              <span>{exportError}</span>
              <button onClick={() => setExportError(null)} className="text-red-400 hover:text-white">✕</button>
            </div>
          )}
          <div className="px-5 py-4 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-h3 text-[var(--color-ink)]">Execution Log</h2>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Audit trail of all actions executed in this session and historical records.
              </p>
            </div>
            <div className="flex items-center gap-2">
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

          {log.length === 0 ? (
            <EmptyState message="No actions have been executed yet." />
          ) : (
            <table className="data-table" data-lenis-prevent>
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Alert ID</th>
                  <th>Action Type</th>
                  <th>Actor</th>
                  <th>Outcome</th>
                  <th>Executed At</th>
                </tr>
              </thead>
              <tbody>
                {log.map((entry) => (
                  <tr key={`${entry.log_id}-${entry.executed_at}`}>
                    <td><code className="text-xs font-mono text-[var(--color-muted)]">#{entry.log_id}</code></td>
                    <td><code className="text-xs bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded font-mono">{entry.alert_id}</code></td>
                    <td><code className="text-xs bg-[var(--color-accent-light)] text-[var(--color-accent)] px-1.5 py-0.5 rounded font-mono">{entry.action_type}</code></td>
                    <td><span className="badge badge-low">{formatLabel(entry.actor)}</span></td>
                    <td>
                      <span className={`badge ${entry.outcome === "success" ? "badge-resolved" : "badge-critical"}`}>
                        {formatLabel(entry.outcome)}
                      </span>
                    </td>
                    <td className="text-xs text-[var(--color-muted)] whitespace-nowrap">{formatDateTime(entry.executed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      </motion.div>
    </PageShell>
  );
}
