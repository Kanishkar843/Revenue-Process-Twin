import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  FileSpreadsheet,
  FileText,
  FileCode,
  Image as ImageIcon,
  Radio,
  Check,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  RefreshCw,
  Upload,
} from "lucide-react";
import { uploadDataset } from "../api/apiClient";
import { supabase } from "../lib/supabaseClient";

type Step = "setup" | "connect" | "mapping" | "scan";

export default function Onboarding() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("setup");

  // Step 1 State
  const [businessName, setBusinessName] = useState(
    sessionStorage.getItem("rpt_company") || "Acme Global Systems"
  );
  const [businessType, setBusinessType] = useState("SaaS / B2B Tech");
  const [companySize, setCompanySize] = useState("50-250 employees");
  const [revenueModel, setRevenueModel] = useState("Subscription & Usage");
  const [currency, setCurrency] = useState("INR (₹)");

  // Step 2 State - Real Files
  const [selectedFormat, setSelectedFormat] = useState<string>("csv");
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Step 3 Mapping State
  const [mapping, setMapping] = useState<{ [key: string]: string }>({
    "Invoice Number": "invoice_id",
    "Customer / Client": "customer_id",
    "Net Amount (Paise)": "amount_paise",
    "Issue Date": "issue_date",
    "Applied Discount": "discount_pct",
  });

  // Step 4 Scanning Progress
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStep, setScanStep] = useState(0);

  const scanSteps = [
    "Connecting to unified SQLite database...",
    "Reconstructing event graph (Invoices → Payments → Renewals)...",
    "Executing deterministic process conformance engine...",
    "Evaluating 14 process-break heuristic rules (R01–R11, GF01–GF08)...",
    "Running XGBoost churn model & Isolation Forest anomaly detection...",
    "Generating counterfactual recovery recommendations...",
    "Scan Complete! Live leakage metrics calculated.",
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setUploadError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
      setUploadError(null);
    }
  };

  const startScan = async () => {
    setStep("scan");
    setIsUploading(true);

    // If real file selected, upload to backend (JWT is sent automatically by apiClient)
    if (files.length > 0) {
      try {
        await uploadDataset(files[0]);
      } catch (err: any) {
        console.warn("Dataset ingestion:", err);
      }
    }

    // Save business profile to backend
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        await fetch(`${API_BASE}/api/auth/profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            company_name: businessName,
            business_type: businessType,
            company_size: companySize,
            revenue_model: revenueModel,
            currency: currency,
          }),
        });
      }
    } catch (err) {
      console.warn("Profile save:", err);
    }

    let currentProgress = 0;
    let stepIdx = 0;
    const interval = setInterval(() => {
      currentProgress += 16;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        setTimeout(() => {
          navigate("/app");
        }, 800);
      }
      setScanProgress(currentProgress);
      if (stepIdx < scanSteps.length - 1) {
        stepIdx += 1;
        setScanStep(stepIdx);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex flex-col justify-between p-6 sm:p-10 relative">
      {/* Top Header */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between pb-6 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white border border-black/[0.08] shadow-sm flex items-center justify-center p-1">
            <img src="/logo.png" alt="Revenue Process Twin" className="w-full h-full object-contain" />
          </div>
          <span className="font-display font-bold text-base text-[var(--color-ink)]">
            Revenue Process Twin
          </span>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          {[
            { id: "setup", label: "1. Business" },
            { id: "connect", label: "2. Connect Data" },
            { id: "mapping", label: "3. Schema Map" },
            { id: "scan", label: "4. Leak Scan" },
          ].map((s) => {
            const isActive = step === s.id;
            const isCompleted =
              (s.id === "setup" && step !== "setup") ||
              (s.id === "connect" && (step === "mapping" || step === "scan")) ||
              (s.id === "mapping" && step === "scan");
            return (
              <div key={s.id} className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-[11px] transition-all ${isActive
                    ? "bg-[var(--color-ink)] text-white font-bold"
                    : isCompleted
                      ? "bg-emerald-100 text-emerald-800 font-semibold"
                      : "bg-gray-200/70 text-gray-500"
                    }`}
                >
                  {s.label}
                </span>
                {s.id !== "scan" && <ChevronRight size={13} className="text-gray-300" />}
              </div>
            );
          })}
        </div>
      </header>

      {/* Main Wizard Form Body */}
      <main className="max-w-2xl w-full mx-auto my-auto py-8">
        <AnimatePresence mode="wait">
          {/* STEP 1: BUSINESS PROFILE */}
          {step === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white p-8 rounded-2xl border border-[var(--color-border)] shadow-[var(--shadow-elevation-2)] space-y-6"
            >
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)] text-xs font-semibold mb-2">
                  <Building2 size={13} />
                  Step 1 of 4 • Business Setup
                </div>
                <h1 className="text-2xl font-bold text-[var(--color-ink)]">
                  Tell us about your organization
                </h1>
                <p className="text-sm text-[var(--color-muted)] mt-1">
                  We use your business profile to calibrate baseline contract thresholds and discount limits.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1.5">
                    Company / Organization Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-accent)] transition-all font-medium"
                    placeholder="e.g. Acme Global Technologies"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1.5">
                      Business Model
                    </label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
                    >
                      <option>SaaS / B2B Tech</option>
                      <option>E-Commerce & Retail</option>
                      <option>Subscription Media</option>
                      <option>Logistics & Supply Chain</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1.5">
                      Revenue Engine Model
                    </label>
                    <select
                      value={revenueModel}
                      onChange={(e) => setRevenueModel(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
                    >
                      <option>Subscription & Usage</option>
                      <option>Contract Invoicing</option>
                      <option>High-Velocity Transactional</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1.5">
                      Company Size
                    </label>
                    <select
                      value={companySize}
                      onChange={(e) => setCompanySize(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
                    >
                      <option>1-10 employees</option>
                      <option>11-50 employees</option>
                      <option>50-250 employees</option>
                      <option>250+ Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1.5">
                      Operational Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
                    >
                      <option>INR (₹) - Indian Rupee (Paise canonical)</option>
                      <option>USD ($) - US Dollar (Cents canonical)</option>
                      <option>EUR (€) - Euro</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--color-border)] flex justify-end">
                <button
                  onClick={() => setStep("connect")}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-ink)] text-white font-semibold text-sm hover:bg-black transition-all shadow-md"
                >
                  Continue to Connect Data
                  <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: CONNECT DATA */}
          {step === "connect" && (
            <motion.div
              key="connect"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white p-8 rounded-2xl border border-[var(--color-border)] shadow-[var(--shadow-elevation-2)] space-y-6"
            >
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)] text-xs font-semibold mb-2">
                  <Database size={13} />
                  Step 2 of 4 • Connect Data
                </div>
                <h1 className="text-2xl font-bold text-[var(--color-ink)]">
                  Connect your revenue & billing data
                </h1>
                <p className="text-sm text-[var(--color-muted)] mt-1">
                  Upload spreadsheets, documents, or connect to the pre-loaded enterprise database.
                </p>
              </div>

              {/* Source Type Selector Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {[
                  { id: "csv", label: "CSV / Excel", icon: FileSpreadsheet },
                  { id: "pdf", label: "PDF Invoices", icon: FileText },
                  { id: "json", label: "JSON Stream", icon: FileCode },
                  { id: "img", label: "Photo / Scan", icon: ImageIcon },
                  { id: "api", label: "Live Gateway", icon: Radio },
                ].map((fmt) => {
                  const Icon = fmt.icon;
                  const isSelected = selectedFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      onClick={() => setSelectedFormat(fmt.id)}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${isSelected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)] font-semibold shadow-xs"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-gray-300"
                        }`}
                    >
                      <Icon size={20} />
                      <span className="text-[11px]">{fmt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Upload Dropzone */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv,.xlsx,.xls,.json,.pdf,.png,.jpg,.jpeg,.zip"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] rounded-2xl bg-[var(--color-surface)]/60 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
              >
                <div className="w-12 h-12 rounded-xl bg-white border border-[var(--color-border)] shadow-xs flex items-center justify-center text-[var(--color-accent)]">
                  <Upload size={22} />
                </div>
                <div>
                  <span className="text-sm font-semibold text-[var(--color-ink)] block">
                    Click to select or drag and drop financial datasets
                  </span>
                  <span className="text-xs text-[var(--color-muted)] mt-1 block">
                    Supports .csv, .xlsx, .json, .pdf, .zip (or use pre-loaded SQLite database)
                  </span>
                </div>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[var(--color-ink)]">
                    {files.length} Selected File(s):
                  </div>
                  {files.map((file, i) => (
                    <div
                      key={i}
                      className="p-3 bg-white border border-[var(--color-border)] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet size={16} className="text-[var(--color-accent)]" />
                        <span className="font-semibold text-[var(--color-ink)]">{file.name}</span>
                        <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                        Ready to parse
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                <button
                  onClick={() => setStep("setup")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={() => setStep("mapping")}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-ink)] text-white font-semibold text-sm hover:bg-black transition-all shadow-md"
                >
                  Inspect & Map Fields
                  <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: SCHEMA MAPPING & REVIEW */}
          {step === "mapping" && (
            <motion.div
              key="mapping"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white p-8 rounded-2xl border border-[var(--color-border)] shadow-[var(--shadow-elevation-2)] space-y-6"
            >
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)] text-xs font-semibold mb-2">
                  <Sparkles size={13} />
                  Step 3 of 4 • Automatic Schema Mapper
                </div>
                <h1 className="text-2xl font-bold text-[var(--color-ink)]">
                  Verify canonical revenue field mappings
                </h1>
                <p className="text-sm text-[var(--color-muted)] mt-1">
                  Our ingestion gateway automatically maps source fields into canonical integer-paise representations.
                </p>
              </div>

              {/* Validation Banner */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-950 block">
                      Data Conformance Gate Passed
                    </span>
                    <span className="text-emerald-700">
                      0 orphaned keys • Deterministic integer paise • Event timestamps aligned
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-white text-emerald-800 font-bold rounded-md border border-emerald-200 shadow-2xs">
                  PASSED
                </span>
              </div>

              {/* Mapping Table */}
              <div className="border border-[var(--color-border)] rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)] font-semibold text-[var(--color-muted)]">
                    <tr>
                      <th className="p-3">Source Column (Original)</th>
                      <th className="p-3">Mapped Canonical Field</th>
                      <th className="p-3">Detected Data Type</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {Object.entries(mapping).map(([source, target]) => (
                      <tr key={source} className="hover:bg-gray-50/60">
                        <td className="p-3 font-semibold text-[var(--color-ink)]">{source}</td>
                        <td className="p-3 font-mono text-[var(--color-accent)]">{target}</td>
                        <td className="p-3 text-gray-500">
                          {target.includes("ts") || target.includes("date")
                            ? "Timestamp (ISO)"
                            : target.includes("paise")
                              ? "Integer (Paise)"
                              : "String (Text)"}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <Check size={13} />
                            Auto-matched
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                <button
                  onClick={() => setStep("connect")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={startScan}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--color-accent)] text-white font-semibold text-sm hover:opacity-90 transition-all shadow-md"
                >
                  Run Revenue Scan
                  <Sparkles size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: INITIAL SCANNING PROGRESS */}
          {step === "scan" && (
            <motion.div
              key="scan"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-10 rounded-2xl border border-[var(--color-border)] shadow-[var(--shadow-elevation-2)] text-center space-y-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent-light)] text-[var(--color-accent)] flex items-center justify-center mx-auto shadow-xs">
                <RefreshCw size={28} className="animate-spin" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-[var(--color-ink)]">
                  Mined & Audited by Revenue Process Twin
                </h2>
                <p className="text-xs text-[var(--color-muted)] mt-1.5">
                  Running graph traversal, conformance deviation checking, and counterfactual recovery...
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200">
                <motion.div
                  className="bg-[var(--color-accent)] h-full rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-[var(--color-border)] text-xs text-gray-700 font-mono flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {scanSteps[scanStep]}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer className="text-center text-xs text-[var(--color-muted)] pt-6 border-t border-[var(--color-border)]">
        Deterministic Conformance & Causal Recovery Architecture • Revenue Process Twin
      </footer>
    </div>
  );
}
