import { useState, useEffect } from "react";
import { PageShell } from "../components/layout/PageShell";
import { PageHeader } from "../components/layout/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, AlertTriangle, CheckCircle2, Zap, Pause, Play, Activity } from "lucide-react";
import { formatINR } from "../lib/format";
import { getRecentStreamEvents } from "../api/apiClient";

interface StreamEvent {
  id: string;
  timestamp: string;
  type: "INVOICE_ISSUED" | "PAYMENT_SUCCEEDED" | "DUPLICATE_PAYMENT" | "UNAPPROVED_DISCOUNT" | "RENEWAL_EXPIRING";
  customer: string;
  amountRs: number;
  severity: "info" | "warning" | "critical";
  message: string;
}

export default function LiveMonitor() {
  const [isLive, setIsLive] = useState(true);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);

  useEffect(() => {
    let timer: any;
    const fetchEvents = () => {
      getRecentStreamEvents(20)
        .then((res) => {
          if (res && res.events) {
            setEvents(res.events);
            setTotalCount(res.total_events || res.events.length);
          }
        })
        .catch(() => { });
    };

    fetchEvents();
    if (isLive) {
      timer = setInterval(fetchEvents, 3000);
    }
    return () => clearInterval(timer);
  }, [isLive]);

  return (
    <PageShell title="Live Stream Monitor">
      <PageHeader
        title="Live Stream Monitor"
        subtitle="Real-time ingestion feed monitoring live webhook events and incremental leakage detection."
        actions={
          <button
            onClick={() => setIsLive(!isLive)}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isLive
              ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              }`}
          >
            {isLive ? <Pause size={14} /> : <Play size={14} />}
            {isLive ? "Pause Stream" : "Resume Stream"}
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Status Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--color-muted)] font-semibold">Ingestion Status</div>
              <div className="text-lg font-bold text-[var(--color-ink)] flex items-center gap-2 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                {isLive ? "Active / Listening" : "Paused"}
              </div>
            </div>
            <Radio size={24} className="text-[var(--color-accent)] opacity-80" />
          </div>

          <div className="card p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--color-muted)] font-semibold">Events Processed Today</div>
              <div className="text-lg font-bold text-[var(--color-ink)] font-display mt-1">{totalCount.toLocaleString()}</div>
            </div>
            <Activity size={24} className="text-emerald-600 opacity-80" />
          </div>

          <div className="card p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--color-muted)] font-semibold">Stream Endpoint</div>
              <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 mt-1">
                POST /api/streams/STR-001/events
              </div>
            </div>
            <Zap size={24} className="text-amber-500 opacity-80" />
          </div>
        </div>

        {/* Real-time Ticker */}
        <div className="card p-6 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
              <Zap size={16} className="text-[var(--color-accent)]" />
              Incoming Real-time Event Stream
            </h3>
            <span className="text-xs text-[var(--color-muted)]">Auto-scroll enabled</span>
          </div>

          <div className="space-y-3 font-mono text-xs max-h-[500px] overflow-y-auto pr-2">
            <AnimatePresence initial={false}>
              {events.map((evt) => (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${evt.severity === "critical"
                    ? "bg-red-50/60 border-red-200 text-red-950"
                    : evt.severity === "warning"
                      ? "bg-amber-50/60 border-amber-200 text-amber-950"
                      : "bg-gray-50 border-gray-200 text-gray-900"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-[11px]">{evt.timestamp}</span>
                    <span className="font-bold text-[11px] px-2 py-0.5 rounded bg-white border shadow-2xs">
                      {evt.id}
                    </span>
                    <span className="font-semibold">{evt.customer}</span>
                  </div>

                  <div className="flex items-center gap-4 text-[11px]">
                    <span>{evt.message}</span>
                    <span className="font-bold">{formatINR(evt.amountRs)}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
