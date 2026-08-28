/**
 * apiClient.ts - Typed fetch wrappers for all Revenue Process Twin API routes.
 *
 * Configuration:
 *   VITE_API_BASE_URL  - FastAPI backend  (e.g. http://localhost:8000)
 *   VITE_OLLAMA_URL    - Ollama local LLM (e.g. http://localhost:11434)
 *   VITE_OLLAMA_MODEL  - Model name        (default: "llama3")
 */
import type {
  AlertsResponse,
  CustomerRisk,
  CustomerExplain,
  RecoverableSummary,
  ChatRequest,
  ChatResponse,
  ActionExecuteRequest,
  ActionExecuteResponse,
  HealthResponse,
} from "../types/interfaces";
import { supabase } from "../lib/supabaseClient";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL ?? "llama3";

/** Reads the current Supabase session token and attaches it to every API request. */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

/* -- Core Analytical Read Endpoints -------------------------------- */

export const getAlerts = (params?: {
  page?: number;
  page_size?: number;
  severity?: string;
  status?: string;
  customer_id?: string;
}): Promise<AlertsResponse> => {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  if (params?.severity) qs.set("severity", params.severity);
  if (params?.status) qs.set("status", params.status);
  if (params?.customer_id) qs.set("customer_id", params.customer_id);
  const query = qs.toString();
  return apiFetch<AlertsResponse>(`/api/alerts${query ? `?${query}` : ""}`);
};

export const getRecoverableSummary = (): Promise<RecoverableSummary> =>
  apiFetch<RecoverableSummary>("/api/recoverable-summary");

export const getCustomerRisk = (id: string): Promise<CustomerRisk> =>
  apiFetch<CustomerRisk>(`/api/customer/${id}/risk`);

export const getCustomerExplain = (id: string): Promise<CustomerExplain> =>
  apiFetch<CustomerExplain>(`/api/customer/${id}/explain`);

export const getHealth = (): Promise<HealthResponse> =>
  apiFetch<HealthResponse>("/api/health");

export const getAuditLog = (params?: { page?: number; page_size?: number }): Promise<any> => {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  const query = qs.toString();
  return apiFetch<any>(`/api/audit${query ? `?${query}` : ""}`);
};

/* -- Actions & Chat ------------------------------------------------ */

export const postChat = (body: ChatRequest): Promise<ChatResponse> =>
  apiFetch<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const postExecuteAction = (
  body: ActionExecuteRequest
): Promise<ActionExecuteResponse> =>
  apiFetch<ActionExecuteResponse>("/api/actions/execute", {
    method: "POST",
    body: JSON.stringify(body),
  });

/* -- AI Narrator - Ollama streaming -------------------------------- */

export async function* streamOllamaChat(
  prompt: string
): AsyncGenerator<string> {
  try {
    const res = await postChat({ query: prompt });
    const fullText = res.answer || res.narrative || "No narrative generated.";
    const words = fullText.split(" ");
    for (const word of words) {
      yield word + " ";
      await new Promise((r) => setTimeout(r, 15));
    }
  } catch (err) {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          stream: false,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.message?.content || "No narrative generated.";
        const words = text.split(" ");
        for (const word of words) {
          yield word + " ";
          await new Promise((r) => setTimeout(r, 15));
        }
        return;
      }
    } catch {
      // Fallback failed
    }
    throw err;
  }
}

/* -- Universal Ingestion Pipeline ---------------------------------- */

export const createIngestionJob = (payload: {
  source_name: string;
  source_type?: string;
  format?: string;
}): Promise<any> =>
  apiFetch<any>("/api/ingestions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getIngestionPreview = (ingestionId: string): Promise<any> =>
  apiFetch<any>(`/api/ingestions/${ingestionId}/preview`);

export const submitSchemaMapping = (
  ingestionId: string,
  payload: { mapping?: Record<string, string>; auto_map?: boolean }
): Promise<any> =>
  apiFetch<any>(`/api/ingestions/${ingestionId}/mapping`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const validateIngestion = (ingestionId: string): Promise<any> =>
  apiFetch<any>(`/api/ingestions/${ingestionId}/validate`, {
    method: "POST",
  });

export const runIngestion = (ingestionId: string): Promise<any> =>
  apiFetch<any>(`/api/ingestions/${ingestionId}/run`, {
    method: "POST",
  });

export const getIngestionStatus = (ingestionId: string): Promise<any> =>
  apiFetch<any>(`/api/ingestions/${ingestionId}`);

export const commitIngestion = (ingestionId: string): Promise<any> =>
  apiFetch<any>(`/api/ingestions/${ingestionId}/commit`, {
    method: "POST",
  });

export const listIngestions = (params?: { page?: number; page_size?: number; status?: string }): Promise<any> => {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString();
  return apiFetch<any>(`/api/ingestions${query ? `?${query}` : ""}`);
};

/* -- Streaming Pipeline -------------------------------------------- */

export const createStream = (payload: { source_name: string; event_type?: string }): Promise<any> =>
  apiFetch<any>("/api/streams", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const postStreamEvent = (streamId: string, event: Record<string, any>): Promise<any> =>
  apiFetch<any>(`/api/streams/${streamId}/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });

export const getStreamStatus = (streamId: string): Promise<any> =>
  apiFetch<any>(`/api/streams/${streamId}`);

export const stopStream = (streamId: string): Promise<any> =>
  apiFetch<any>(`/api/streams/${streamId}/stop`, {
    method: "POST",
  });

export const getRecentStreamEvents = (limit?: number): Promise<any> => {
  const query = limit ? `?limit=${limit}` : "";
  return apiFetch<any>(`/api/streams/events/recent${query}`);
};

export const getInvoices = (params?: { page?: number; page_size?: number; status?: string; customer_id?: string }): Promise<any> => {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  if (params?.status) qs.set("status", params.status);
  if (params?.customer_id) qs.set("customer_id", params.customer_id);
  const query = qs.toString();
  return apiFetch<any>(`/api/invoices${query ? `?${query}` : ""}`);
};

export const getTransactions = (params?: { page?: number; page_size?: number; type?: string; customer_id?: string }): Promise<any> => {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  if (params?.type) qs.set("type", params.type);
  if (params?.customer_id) qs.set("customer_id", params.customer_id);
  const query = qs.toString();
  return apiFetch<any>(`/api/transactions${query ? `?${query}` : ""}`);
};

export const getCustomers = (params?: { page?: number; page_size?: number }): Promise<any> => {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  const query = qs.toString();
  return apiFetch<any>(`/api/customers${query ? `?${query}` : ""}`);
};

export const getRecoveryCases = (params?: { page?: number; page_size?: number; status?: string }): Promise<any> => {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString();
  return apiFetch<any>(`/api/recovery${query ? `?${query}` : ""}`);
};

export const getProcessHealth = (): Promise<any> =>
  apiFetch<any>("/api/processes");

/* -- Quick Upload (Dataset) ---------------------------------------- */

export async function uploadDataset(
  file: File,
  onProgress?: (pct: number) => void
): Promise<import("../types/interfaces").DataUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/api/upload`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 95));
      }
    });

    xhr.addEventListener("load", () => {
      onProgress?.(100);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Invalid JSON response from upload endpoint"));
        }
      } else {
        try {
          const errBody = JSON.parse(xhr.responseText) as { detail?: string };
          reject(new Error(errBody.detail ?? `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.send(formData);
  });
}

/* -- Real Data Export Endpoints ----------------------------------- */

export async function downloadExportFile(url: string, defaultFilename: string): Promise<void> {
  const fullUrl = `${BASE}${url}`;
  const res = await fetch(fullUrl);
  if (!res.ok) {
    let errText = "Unable to generate export. Please try again.";
    try {
      const errJson = await res.json();
      errText = errJson.detail || errText;
    } catch {
      const text = await res.text();
      if (text) errText = text;
    }
    throw new Error(errText);
  }

  let filename = defaultFilename;
  const disposition = res.headers.get("Content-Disposition");
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename=["']?([^"';]+)["']?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
}

export const exportAlertsCsv = (params?: {
  severity?: string;
  status?: string;
  leak_type?: string;
  customer_id?: string;
  search?: string;
}) => {
  const qs = new URLSearchParams();
  if (params?.severity && params.severity !== "all") qs.set("severity", params.severity);
  if (params?.status && params.status !== "all") qs.set("status", params.status);
  if (params?.leak_type && params.leak_type !== "all") qs.set("leak_type", params.leak_type);
  if (params?.customer_id && params.customer_id !== "all") qs.set("customer_id", params.customer_id);
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString();
  return downloadExportFile(`/api/export/alerts/csv${query ? `?${query}` : ""}`, "revenue_leakage_alerts.csv");
};

export const exportAlertsPdf = (params?: {
  severity?: string;
  status?: string;
  leak_type?: string;
  customer_id?: string;
  search?: string;
}) => {
  const qs = new URLSearchParams();
  if (params?.severity && params.severity !== "all") qs.set("severity", params.severity);
  if (params?.status && params.status !== "all") qs.set("status", params.status);
  if (params?.leak_type && params.leak_type !== "all") qs.set("leak_type", params.leak_type);
  if (params?.customer_id && params.customer_id !== "all") qs.set("customer_id", params.customer_id);
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString();
  return downloadExportFile(`/api/export/alerts/pdf${query ? `?${query}` : ""}`, "revenue_leakage_alerts.pdf");
};

export const exportRecoveryCsv = () =>
  downloadExportFile("/api/export/recovery/csv", "recovery_opportunities.csv");

export const exportRecoveryPdf = () =>
  downloadExportFile("/api/export/recovery/pdf", "recovery_opportunities.pdf");

export const exportReportsPdf = (reportId?: string) =>
  downloadExportFile(`/api/export/reports/pdf${reportId ? `?report_id=${reportId}` : ""}`, "executive_revenue_report.pdf");

export const exportReportsCsv = (reportId?: string) =>
  downloadExportFile(`/api/export/reports/csv${reportId ? `?report_id=${reportId}` : ""}`, "executive_revenue_data.csv");

export const exportAuditCsv = () =>
  downloadExportFile("/api/export/audit/csv", "audit_ledger.csv");

export const exportAuditPdf = () =>
  downloadExportFile("/api/export/audit/pdf", "audit_ledger.pdf");
