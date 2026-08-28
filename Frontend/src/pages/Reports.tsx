import { useState, useEffect } from "react";
import { PageShell } from "../components/layout/PageShell";
import { PageHeader } from "../components/layout/PageHeader";
import { motion } from "framer-motion";
import { FileText, Download, Check, Sparkles, Filter, Calendar } from "lucide-react";
import { formatINR } from "../lib/format";
import { getRecoverableSummary, exportReportsPdf, exportReportsCsv } from "../api/apiClient";
import type { RecoverableSummary } from "../types/interfaces";

export default function Reports() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<RecoverableSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    getRecoverableSummary()
      .then((data) => setSummary(data))
      .catch(() => { });
  }, []);

  const totalLeakage = summary?.total_leakage_rs ?? 0;
  const totalRecovered = summary?.total_recoverable_rs ?? 0;
  const activeAlerts = summary?.active_alerts ?? 0;

  const handleDownload = async (id: string, type: "pdf" | "csv") => {
    setDownloadingId(`${id}-${type}`);
    setErrorMessage(null);
    try {
      if (type === "pdf") {
        await exportReportsPdf(id);
      } else {
        await exportReportsCsv(id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Unable to generate export. Please try again.");
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <PageShell title="Executive Reports & Audits">
      <PageHeader
        title="Executive Reports & Audits"
        subtitle="Export high-level board reports, deterministic audit summaries, and CSV data packages."
        actions={
          <button
            onClick={() => handleDownload("REP-LIVE", "pdf")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-ink)] text-white text-xs font-semibold rounded-lg hover:bg-black transition-all shadow-sm"
          >
            <Sparkles size={14} />
            Generate Board Report PDF
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-950 text-red-300 text-xs font-semibold rounded-xl flex items-center justify-between shadow-lg"
          >
            <div>{errorMessage}</div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="text-xs text-[var(--color-muted)] font-semibold">Total Audited Leakage</div>
            <div className="text-2xl font-bold text-red-600 mt-1 font-display">{formatINR(totalLeakage)}</div>
            <div className="text-[11px] text-gray-500 mt-1">Live SQLite database audit</div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-[var(--color-muted)] font-semibold">Total Recovered Capital</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1 font-display">{formatINR(totalRecovered)}</div>
            <div className="text-[11px] text-emerald-600 mt-1">
              {totalLeakage > 0 ? ((totalRecovered / totalLeakage) * 100).toFixed(1) : 0}% recovery potential
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-[var(--color-muted)] font-semibold">Active Audit Alerts</div>
            <div className="text-2xl font-bold text-[var(--color-ink)] mt-1 font-display">{activeAlerts}</div>
            <div className="text-[11px] text-gray-500 mt-1">Tamper-evident log verified</div>
          </div>
        </div>

        {/* Reports List */}
        <div className="space-y-4">
          <div className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
            <FileText size={16} className="text-[var(--color-accent)]" />
            Generated Audit & Executive Reports
          </div>

          <div className="grid grid-cols-1 gap-4">
            {[
              {
                id: "REP-EXECUTIVE-BOARD",
                title: "Executive Revenue Leakage & Recovery Deck",
                period: "Live Database Audit",
                totalLeakageRs: totalLeakage,
                recoveredRs: totalRecovered,
                criticalAlerts: activeAlerts,
                description: "Comprehensive financial audit deck covering all detected process deviations and recovery actions."
              },
              {
                id: "REP-CONFORMANCE-AUDIT",
                title: "Deterministic Process Conformance Ledger",
                period: "Golden Flow Engine",
                totalLeakageRs: totalLeakage,
                recoveredRs: totalRecovered,
                criticalAlerts: activeAlerts,
                description: "Full event-level audit ledger mapping rule breaches across GF01-GF08 process flows."
              }
            ].map((report) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-5 border border-[var(--color-border)] flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-gray-300 transition-all shadow-sm"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[var(--color-ink)]">{report.title}</h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {report.period}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{report.description}</p>
                    <div className="text-xs text-[var(--color-muted)] mt-2 flex flex-wrap items-center gap-4">
                      <span>Audited Leakage: <strong className="text-red-600 font-semibold">{formatINR(report.totalLeakageRs)}</strong></span>
                      <span>Recoverable: <strong className="text-emerald-600 font-semibold">{formatINR(report.recoveredRs)}</strong></span>
                      <span><strong className="text-gray-900 font-semibold">{report.criticalAlerts}</strong> Critical Alerts</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  <button
                    onClick={() => handleDownload(report.id, "pdf")}
                    disabled={downloadingId === `${report.id}-pdf`}
                    className="px-3.5 py-2 text-xs font-semibold bg-white border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    <Download size={14} />
                    {downloadingId === `${report.id}-pdf` ? "Generating PDF..." : "Export PDF"}
                  </button>

                  <button
                    onClick={() => handleDownload(report.id, "csv")}
                    disabled={downloadingId === `${report.id}-csv`}
                    className="px-3.5 py-2 text-xs font-semibold bg-white border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    <Download size={14} />
                    {downloadingId === `${report.id}-csv` ? "Exporting CSV..." : "Export CSV"}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
