import { useState, useRef, useCallback, type DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet, FileText, FileCode, Archive, Upload,
  CheckCircle2, AlertCircle, X, Clock, Database, RefreshCw,
  Sparkles, ShieldCheck, ArrowUpRight, Zap, Check
} from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { uploadDataset } from "../api/apiClient";
import { getFadeUp, staggerContainer, EASE } from "../lib/motion";
import { formatDateTime } from "../lib/format";
import type { DataUploadResponse, UploadFileType, UploadHistoryEntry } from "../types/interfaces";

// ── File type config ───────────────────────────────────────────
interface FileTypeInfo {
  ext: string;
  label: string;
  description: string;
  icon: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }>;
  tables: string[];
  colorBg: string;
  colorText: string;
  colorBorder: string;
}

const FILE_TYPES: FileTypeInfo[] = [
  {
    ext: ".xlsx",
    label: "Excel Workbook",
    description: "Billing exports, invoice registers, payment ledgers",
    icon: FileSpreadsheet,
    tables: ["invoices", "payments"],
    colorBg: "rgba(34, 197, 94, 0.08)",
    colorText: "#15803d",
    colorBorder: "rgba(34, 197, 94, 0.2)",
  },
  {
    ext: ".xls",
    label: "Excel 97–2003",
    description: "Legacy billing exports in vintage Excel format",
    icon: FileSpreadsheet,
    tables: ["invoices", "payments"],
    colorBg: "rgba(16, 185, 129, 0.08)",
    colorText: "#047857",
    colorBorder: "rgba(16, 185, 129, 0.2)",
  },
  {
    ext: ".csv",
    label: "CSV / Flat File",
    description: "Event logs, telemetry, raw payment transactions",
    icon: FileText,
    tables: ["events"],
    colorBg: "rgba(109, 91, 208, 0.08)",
    colorText: "#5b48c2",
    colorBorder: "rgba(109, 91, 208, 0.2)",
  },
  {
    ext: ".json",
    label: "JSON Schema",
    description: "Alert snapshots, customer records, CRM dumps",
    icon: FileCode,
    tables: ["alerts", "customers"],
    colorBg: "rgba(245, 158, 11, 0.08)",
    colorText: "#b45309",
    colorBorder: "rgba(245, 158, 11, 0.2)",
  },
  {
    ext: ".zip",
    label: "ZIP Bundle",
    description: "Multi-table database dump & complete process twin",
    icon: Archive,
    tables: ["invoices", "payments", "events", "customers"],
    colorBg: "rgba(15, 23, 42, 0.06)",
    colorText: "#0f172a",
    colorBorder: "rgba(15, 23, 42, 0.15)",
  },
];

const SAMPLE_FILES = [
  { name: "q3_billing_export.xlsx", type: ".xlsx", records: 142, size: "48 KB" },
  { name: "event_audit_stream.csv", type: ".csv", records: 310, size: "124 KB" },
  { name: "customer_risk_profile.json", type: ".json", records: 58, size: "18 KB" },
  { name: "full_ledger_bundle.zip", type: ".zip", records: 524, size: "1.2 MB" },
];

const ACCEPTED = FILE_TYPES.map((f) => f.ext).join(", ");

function getFileTypeInfo(filename: string): FileTypeInfo | null {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return FILE_TYPES.find((f) => f.ext === ext) ?? null;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

type UploadState =
  | { phase: "idle" }
  | { phase: "dragging" }
  | { phase: "uploading"; file: File; progress: number }
  | { phase: "success"; response: DataUploadResponse; file: File }
  | { phase: "error"; message: string; file: File };

export default function DataIngestion() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [history, setHistory] = useState<UploadHistoryEntry[]>([
    {
      id: "seed-1",
      file: new File(["mock"], "seed_q3_invoices.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      response: {
        filename: "seed_q3_invoices.xlsx",
        file_type: ".xlsx",
        records_processed: 142,
        tables_updated: ["invoices", "payments"],
        status: "success",
        message: "Successfully ingested 142 records into invoices, payments and refreshed leakage engine.",
      },
      uploadedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fadeUp = getFadeUp();

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setState({ phase: "dragging" });
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!(e.currentTarget as HTMLDivElement).contains(e.relatedTarget as Node)) {
      setState({ phase: "idle" });
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
    else setState({ phase: "idle" });
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function handleSampleUpload(sample: (typeof SAMPLE_FILES)[0]) {
    const sampleContent = sample.type === ".json"
      ? JSON.stringify([{ customer_id: "CUST-SAMPLE-1", company_name: "Acme Corp", plan: "Enterprise", mrr: 10000 }])
      : "customer_id,customer_name,plan,segment,invoice_id,billed_amount,payment_id,paid_amount,payment_status\n" +
      "CUST-S-001,Acme Corp,Enterprise,enterprise,INV-S-101,15000.0,PAY-S-201,15000.0,success\n" +
      "CUST-S-002,Vertex Ltd,Professional,smb,INV-S-102,4500.0,PAY-S-202,4500.0,success\n" +
      "CUST-S-003,Cyberdyne Systems,Enterprise,enterprise,INV-S-103,32000.0,PAY-S-203,32000.0,success\n";

    const fileName = sample.name.endsWith(".json") ? sample.name : sample.name.replace(/\.[^.]+$/, ".csv");
    const mockFile = new File([sampleContent], fileName, {
      type: sample.name.endsWith(".json") ? "application/json" : "text/csv",
    });
    processFile(mockFile);
  }

  async function processFile(file: File) {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const allowed = FILE_TYPES.map((f) => f.ext);
    if (!allowed.includes(ext)) {
      setState({
        phase: "error",
        message: `Unsupported file type "${ext}". Accepted formats: ${ACCEPTED}`,
        file,
      });
      return;
    }

    setState({ phase: "uploading", file, progress: 0 });

    try {
      const response = await uploadDataset(file, (pct) => {
        setState((prev) =>
          prev.phase === "uploading" ? { ...prev, progress: pct } : prev
        );
      });
      queryClient.invalidateQueries();
      setState({ phase: "success", response, file });
      setHistory((prev) => [
        { id: crypto.randomUUID(), file, response, uploadedAt: new Date().toISOString() },
        ...prev,
      ]);
    } catch (err: unknown) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Upload failed",
        file,
      });
    }
  }

  function reset() {
    setState({ phase: "idle" });
  }

  const isDragging = state.phase === "dragging";

  return (
    <PageShell title="Data Ingestion Pipeline">
      <motion.div
        className="flex flex-col gap-6"
        variants={staggerContainer(0.06)}
        initial="initial"
        animate="animate"
      >
        {/* Hero Banner with Status & Stats */}
        <motion.div
          variants={fadeUp}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0a0a0a] via-[#141418] to-[#1f1a2e] p-6 sm:p-8 text-white shadow-xl"
        >
          <div className="absolute right-0 top-0 -mt-8 -mr-8 h-64 w-64 rounded-full bg-[var(--color-accent)]/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md text-[var(--color-accent-300)] mb-3">
                <Zap size={13} />
                <span>Real-Time Engine Ingestion</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white">
                Ingest Billing & Event Datasets
              </h1>
              <p className="mt-1.5 max-w-xl text-xs sm:text-sm text-white/70 leading-relaxed">
                Upload raw transactional ledgers, invoice registers, or usage streams.
                The process twin automatically detects schema, maps tables, and computes counterfactuals.
              </p>
            </div>

            {/* Validation Gates Summary */}
            <div className="flex flex-wrap md:flex-col gap-2.5 bg-white/5 p-3.5 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs font-medium text-white/90">
                <CheckCircle2 size={14} className="text-[#22c55e]" />
                <span>Gate V1–V5 Active</span>
              </div>
              <div className="text-[11px] text-white/60 font-mono">
                Conformance Latency: <span className="text-[#22c55e] font-semibold">3.12 ms</span>
              </div>
              <div className="text-[11px] text-white/60 font-mono">
                5,000 Customers · 3,825 Invoices
              </div>
            </div>
          </div>
        </motion.div>

        {/* Supported Schema Cards */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Supported Schemas & Target Tables
            </h2>
            <span className="text-xs text-[var(--color-muted)]">POST /api/upload</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {FILE_TYPES.map((ft) => {
              const Icon = ft.icon;
              return (
                <div
                  key={ft.ext}
                  className="card p-4 flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-md bg-white border border-black/[0.06]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: ft.colorBg, border: `1px solid ${ft.colorBorder}` }}
                      >
                        <Icon size={18} style={{ color: ft.colorText }} />
                      </div>
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md" style={{ background: ft.colorBg, color: ft.colorText }}>
                        {ft.ext}
                      </span>
                    </div>
                    <div className="font-semibold text-sm text-[var(--color-ink)] mb-0.5">
                      {ft.label}
                    </div>
                    <p className="text-[11px] text-[var(--color-muted)] leading-snug">
                      {ft.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-black/[0.04] flex flex-wrap gap-1">
                    {ft.tables.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/[0.03] text-[var(--color-text)] border border-black/[0.05]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Upload Zone & Interactive Playground */}
        <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Drop Area (2 cols) */}
          <div className="lg:col-span-2">
            {(state.phase === "idle" || state.phase === "dragging") && (
              <div
                className="relative h-full min-h-[260px] rounded-3xl border-2 border-dashed transition-all duration-200 cursor-pointer bg-white p-8 flex flex-col items-center justify-center text-center group"
                style={{
                  borderColor: isDragging ? "var(--color-accent)" : "rgba(0,0,0,0.12)",
                  background: isDragging ? "rgba(109, 91, 208, 0.04)" : "#ffffff",
                  boxShadow: "0 4px 20px -2px rgba(0,0,0,0.03)",
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Upload dataset"
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={ACCEPTED}
                  onChange={handleFileSelect}
                />

                <motion.div
                  animate={isDragging ? { scale: 1.15, y: -6 } : { scale: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors"
                  style={{
                    background: isDragging ? "var(--color-accent)" : "rgba(109, 91, 208, 0.08)",
                    border: `1.5px solid ${isDragging ? "var(--color-accent)" : "rgba(109, 91, 208, 0.2)"}`,
                  }}
                >
                  <Upload
                    size={28}
                    style={{ color: isDragging ? "#fff" : "var(--color-accent)" }}
                  />
                </motion.div>

                <h3 className="text-base font-bold text-[var(--color-ink)]">
                  {isDragging ? "Release to Ingest Dataset" : "Drag and drop your dataset file here"}
                </h3>
                <p className="text-xs text-[var(--color-muted)] mt-1 max-w-sm">
                  or <span className="text-[var(--color-accent)] font-semibold underline">browse local files</span> from your computer
                </p>

                <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--color-muted)] bg-black/[0.03] px-3.5 py-1.5 rounded-full border border-black/[0.04]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                  <span>Multipart Form Data · Max 50 MB · .xlsx, .xls, .csv, .json, .zip</span>
                </div>
              </div>
            )}

            {/* Uploading Phase */}
            {state.phase === "uploading" && (
              <div className="card p-8 flex flex-col items-center justify-center min-h-[260px] gap-5 bg-white text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent-light)] flex items-center justify-center animate-bounce">
                  <Database size={30} className="text-[var(--color-accent)]" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[var(--color-ink)]">{state.file.name}</h3>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">{fmtBytes(state.file.size)}</p>
                </div>
                <div className="w-full max-w-md">
                  <div className="flex justify-between text-xs text-[var(--color-muted)] mb-1.5 font-medium">
                    <span>Parsing rows & running conformance check...</span>
                    <span className="font-mono">{state.progress}%</span>
                  </div>
                  <div className="h-2.5 bg-black/[0.05] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-[var(--color-accent)]"
                      initial={{ width: "0%" }}
                      animate={{ width: `${state.progress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Success Phase */}
            {state.phase === "success" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card p-6 bg-white border-l-4 border-l-[#22c55e] flex flex-col justify-between"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#e8f5ef] flex items-center justify-center flex-shrink-0 text-[#16a34a]">
                    <CheckCircle2 size={26} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-[var(--color-ink)]">
                        Ingestion & Engine Refresh Complete
                      </span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#e8f5ef] text-[#16a34a]">
                        {state.response.file_type}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                      {state.response.message}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
                      <div className="bg-[#f8f9fb] p-3 rounded-xl border border-black/[0.04]">
                        <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Processed</div>
                        <div className="text-lg font-bold font-display text-[var(--color-ink)] mt-0.5">
                          {state.response.records_processed} records
                        </div>
                      </div>
                      <div className="bg-[#f8f9fb] p-3 rounded-xl border border-black/[0.04]">
                        <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Updated Tables</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {state.response.tables_updated.map((t) => (
                            <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-black/[0.06] font-semibold">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-[#f8f9fb] p-3 rounded-xl border border-black/[0.04]">
                        <div className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Engine State</div>
                        <div className="text-xs text-[#16a34a] font-bold mt-1 flex items-center gap-1">
                          <Check size={12} /> Live Synced
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5 mt-2 justify-end">
                  <button className="btn-ghost text-xs" onClick={reset}>
                    Close
                  </button>
                  <button className="btn-primary text-xs" onClick={reset}>
                    <Upload size={12} />
                    Upload Another Dataset
                  </button>
                </div>
              </motion.div>
            )}

            {/* Error Phase */}
            {state.phase === "error" && (
              <div className="card p-6 bg-white border-l-4 border-l-[var(--color-severity-critical-dot)]">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--color-severity-critical-bg)] flex items-center justify-center flex-shrink-0 text-[var(--color-severity-critical-dot)]">
                    <AlertCircle size={26} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-base text-[var(--color-ink)]">Ingestion Error</h3>
                    <p className="text-xs text-[var(--color-muted)] mt-1">{state.message}</p>
                    <div className="mt-4">
                      <button className="btn-primary text-xs" onClick={reset}>
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Demo Datasets (1 col) */}
          <div className="card p-5 bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-[var(--color-accent)]" />
                <h3 className="font-bold text-sm text-[var(--color-ink)]">Sample Test Datasets</h3>
              </div>
              <p className="text-xs text-[var(--color-muted)] mb-3 leading-relaxed">
                Click any pre-configured enterprise fixture to test the validation pipeline and trigger instant leakage detection.
              </p>

              <div className="flex flex-col gap-2">
                {SAMPLE_FILES.map((sample) => (
                  <button
                    key={sample.name}
                    onClick={() => handleSampleUpload(sample)}
                    disabled={state.phase === "uploading"}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-black/[0.06] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-light)]/[0.2] transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-7 h-7 rounded-lg bg-black/[0.04] group-hover:bg-white flex items-center justify-center text-xs font-mono font-bold text-[var(--color-ink)]">
                        {sample.type}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-[var(--color-ink)] truncate">{sample.name}</div>
                        <div className="text-[10px] text-[var(--color-muted)]">{sample.records} records · {sample.size}</div>
                      </div>
                    </div>
                    <ArrowUpRight size={14} className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-black/[0.06] flex items-center justify-between text-[11px] text-[var(--color-muted)]">
              <span>Ingestion Endpoint</span>
              <code className="font-mono text-[10px] bg-black/[0.03] px-1.5 py-0.5 rounded">POST /api/upload</code>
            </div>
          </div>
        </motion.div>

        {/* Upload History Ledger */}
        <motion.div variants={fadeUp} className="card bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-[var(--color-ink)]">Recent Ingestion Log</h3>
              <p className="text-xs text-[var(--color-muted)]">Audit ledger of datasets synced into the process twin database</p>
            </div>
            {history.length > 0 && (
              <button className="btn-ghost text-xs" onClick={() => setHistory([])}>
                Clear History
              </button>
            )}
          </div>

          <div className="overflow-x-auto" data-lenis-prevent>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dataset File</th>
                  <th>Format</th>
                  <th>Records</th>
                  <th>Tables Synced</th>
                  <th>Status</th>
                  <th>Ingested At</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <div className="font-semibold text-xs text-[var(--color-ink)] flex items-center gap-2">
                        <FileSpreadsheet size={14} className="text-[var(--color-accent)]" />
                        <span>{entry.response.filename}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-black/[0.04]">
                        {entry.response.file_type}
                      </span>
                    </td>
                    <td className="tabular font-medium text-xs">
                      {entry.response.records_processed} rows
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {entry.response.tables_updated.map((t) => (
                          <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f0eefa] text-[var(--color-accent)] font-semibold">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-resolved">Processed</span>
                    </td>
                    <td className="text-xs text-[var(--color-muted)] whitespace-nowrap">
                      {formatDateTime(entry.uploadedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>
    </PageShell>
  );
}
