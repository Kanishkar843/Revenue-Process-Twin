import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageSquare, Cpu } from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { MoneyValue } from "../components/shared/MoneyValue";
import { streamOllamaChat } from "../api/apiClient";
import { formatLabel } from "../lib/format";
import { getFadeUp } from "../lib/motion";
import type { ChatResponse } from "../types/interfaces";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  evidence?: ChatResponse;
}

const SUGGESTED_QUESTIONS = [
  "Why is Acme Corp losing revenue?",
  "What happened with Vertex Ltd?",
  "Which customers have duplicate payments?",
  "Show me the biggest recovery opportunity",
];

function RecoveryBar({ leak, recovery }: { leak: number; recovery: number }) {
  const pct = leak > 0 ? Math.min((recovery / leak) * 100, 100) : 0;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-[var(--color-muted)] mb-1">
        <span>Recovery vs leak</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-[var(--color-accent)]"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

function EvidenceCard({ data }: { data: ChatResponse }) {
  const fadeUp = getFadeUp();
  return (
    <motion.div
      className="mt-3 border border-[var(--color-border)] rounded-md p-3 bg-[var(--color-surface-2)] text-xs max-w-[75%]"
      {...fadeUp}
    >
      <div className="text-micro mb-2">Evidence</div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <div className="text-[var(--color-muted)] mb-0.5">Leak Amount</div>
          <MoneyValue value={data.leak_amount_rs} />
          <RecoveryBar leak={data.leak_amount_rs} recovery={data.recovery_estimate_rs} />
        </div>
        <div>
          <div className="text-[var(--color-muted)] mb-0.5">Recovery Estimate</div>
          <MoneyValue value={data.recovery_estimate_rs} accent />
        </div>
      </div>
      <div className="mb-2">
        <div className="text-[var(--color-muted)] mb-0.5">Process Break</div>
        <code className="font-mono text-[var(--color-ink)]">{data.process_break}</code>
      </div>
      <div className="mb-2">
        <div className="text-[var(--color-muted)] mb-1">Connected Entities</div>
        <div className="flex flex-wrap gap-1">
          {data.connected_entities.map(e => (
            <span key={e} className="bg-white border border-[var(--color-border)] px-1.5 py-0.5 rounded font-mono text-[10px]">
              {e}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[var(--color-muted)] mb-0.5">Recommended Action</div>
        <p className="text-[var(--color-text)]">{data.recommended_action}</p>
      </div>
    </motion.div>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hello! I'm the Revenue Process Twin Narrator powered by local Hugging Face Qwen LLM. Ask me about any customer, revenue leakage pattern, or recovery opportunity.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fadeUp = getFadeUp();

  async function handleSend(query?: string) {
    const q = query ?? input.trim();
    if (!q || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: q };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const assistantId = crypto.randomUUID();

    try {
      // Stream tokens from local AI narrator engine
      const stream = streamOllamaChat(q);
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", text: "" }]);
      for await (const token of stream) {
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, text: m.text + token } : m)
        );
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, text: `⚠ Local AI Narrator temporarily unavailable: ${err instanceof Error ? err.message : "Unknown error"}. Ensure backend service and local Hugging Face Qwen engine are running.` }
            : m
        )
      );
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }

  return (
    <PageShell title="Narrator Chat">
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pb-4 pr-1" data-lenis-prevent>
          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"}>
                  {msg.text}
                </div>
                {msg.evidence && <EvidenceCard data={msg.evidence} />}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div
              className="flex items-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="chat-bubble-assistant flex items-center gap-2">
                <span className="spinner" style={{ width: 14, height: 14 }} />
                <span className="text-[var(--color-muted)] text-sm">Analyzing…</span>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggested questions */}
        <AnimatePresence>
          {messages.length <= 1 && !loading && (
            <motion.div
              className="flex flex-wrap gap-2 py-3"
              {...fadeUp}
            >
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  className="btn-ghost text-xs flex items-center gap-1.5"
                  onClick={() => handleSend(q)}
                >
                  <MessageSquare size={11} /> {q}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div className="card p-3 flex items-center gap-2">
          <input
            id="chat-input"
            className="input-base flex-1 border-0 focus:ring-0 outline-none bg-transparent"
            placeholder="Ask about a customer, leak type, or pattern…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={loading}
          />
          <motion.button
            id="chat-send-btn"
            className="btn-primary py-2 px-4"
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            whileTap={{ scale: 0.97 }}
          >
            <Send size={13} />
          </motion.button>
        </div>
      </div>
    </PageShell>
  );
}
