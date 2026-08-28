import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import {
  AlertTriangle, RefreshCcw, TrendingDown, Shield, ChevronRight,
  BarChart2, Zap, FileText, ArrowRight, Check, X, Database,
  GitBranch, Search, ArrowDown,
} from "lucide-react";
import { DisplayCards } from "../components/ui/DisplayCards";
import { EASE } from "../lib/motion";
import { formatINRShort } from "../lib/format";
import { useSummary } from "../hooks/useSummary";

const SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };
const RV = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReduced) return;
    const ctx = canvas.getContext("2d")!;
    let w = canvas.offsetWidth, h = canvas.offsetHeight;
    canvas.width = w; canvas.height = h;
    type N = { x: number; y: number; vx: number; vy: number; op: number; dop: number };
    const nodes: N[] = Array.from({ length: 18 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.14, vy: (Math.random() - 0.5) * 0.14,
      op: Math.random() * 0.4 + 0.1, dop: (Math.random() - 0.5) * 0.003,
    }));
    const C = 140, colorRgb = "109, 91, 208"; let last = 0;
    function draw(ts: number) {
      if (ts - last < 33) { animRef.current = requestAnimationFrame(draw); return; }
      last = ts; ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        n.op += n.dop; if (n.op <= 0.05 || n.op >= 0.5) n.dop *= -1;
      }
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < C) {
          ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = "rgba(" + colorRgb + "," + ((1 - d / C) * 0.28) + ")"; ctx.lineWidth = 0.7; ctx.stroke();
        }
      }
      for (const n of nodes) {
        ctx.beginPath(); ctx.arc(n.x, n.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(26,26,26," + (n.op * 0.4) + ")"; ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) animRef.current = requestAnimationFrame(draw);
      else cancelAnimationFrame(animRef.current);
    }, { threshold: 0 });
    if (heroRef.current) obs.observe(heroRef.current);
    const resize = () => { w = canvas.offsetWidth; h = canvas.offsetHeight; canvas.width = w; canvas.height = h; };
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(animRef.current); obs.disconnect(); window.removeEventListener("resize", resize); };
  }, [prefersReduced]);

  return (
    <div ref={heroRef} className="absolute inset-0 overflow-hidden pointer-events-none">
      <canvas ref={canvasRef} className="w-full h-full opacity-60" />
    </div>
  );
}

function AnimNum({ value, prefix = "", suffix = "", delay = 0 }: { value: number; prefix?: string; suffix?: string; delay?: number }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.5 });
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!inView) return;
    if (reduced) { setCount(value); return; }
    const t = setTimeout(() => {
      let start: number | null = null;
      function tick(ts: number) {
        if (!start) start = ts;
        const p = Math.min((ts - start) / 900, 1);
        setCount(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, delay * 1000);
    return () => clearTimeout(t);
  }, [inView, value, reduced, delay]);

  const display = value >= 100000
    ? `${prefix}${formatINRShort(count).replace("₹", "")}`
    : `${prefix}${count}${suffix}`;
  return <span ref={ref}>{display}</span>;
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"}
      variants={{ hidden: RV.hidden, visible: { ...RV.visible, transition: { ...RV.visible.transition, delay } } }}
      className={className}>
      {children}
    </motion.div>
  );
}

const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Product", href: "#product" },
  { label: "Live Data", href: "#data" },
] as const;

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState(0);
  const [pill, setPill] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const navRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const el = btnRefs.current[active];
    const con = navRef.current;
    if (!el || !con) return;
    const er = el.getBoundingClientRect(), cr = con.getBoundingClientRect();
    setPill({ left: er.left - cr.left, width: er.width });
  }, [active]);

  useEffect(() => {
    const s = document.getElementById("landing-scroll");
    if (!s) return;
    const h = () => setScrolled(s.scrollTop > 60);
    s.addEventListener("scroll", h, { passive: true });
    return () => s.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    const sections = ["how", "product", "data"].map(id => document.getElementById(id));
    const obs = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const idx = sections.indexOf(e.target as HTMLElement);
          if (idx !== -1) setActive(idx);
        }
      }
    }, { threshold: 0.35, rootMargin: "0px 0px -30% 0px" });
    sections.forEach(s => s && obs.observe(s));
    return () => obs.disconnect();
  }, []);

  const click = (i: number, item: typeof NAV[number]) => {
    setActive(i);
    document.querySelector(item.href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className={`sticky top-0 z-40 flex items-center justify-between px-8 transition-all duration-300 ${scrolled
      ? "py-3 bg-white/90 backdrop-blur-xl border-b border-black/[0.06] shadow-[0_1px_16px_-4px_rgba(0,0,0,0.08)]"
      : "py-4 bg-transparent"
      }`}>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-white border border-black/[0.08] shadow-sm flex items-center justify-center overflow-hidden p-1">
          <img src="/logo.png" alt="Revenue Process Twin" className="w-full h-full object-contain" />
        </div>
        <span className="font-display font-bold text-sm text-[var(--color-ink)] hidden sm:block">Revenue Process Twin</span>
      </div>

      <nav ref={navRef} className="hidden md:flex items-center relative rounded-full px-1.5 py-1.5" style={{
        background: "rgba(255,255,255,0.78)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(0,0,0,0.07)",
        boxShadow: "0 2px 12px -2px rgba(0,0,0,0.06)",
      }}>
        <motion.div
          className="absolute top-1.5 bottom-1.5 rounded-full pointer-events-none"
          animate={pill}
          transition={SPRING}
          style={{
            background: "rgba(255,255,255,0.95)",
            boxShadow: "0 1px 8px -2px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.06)",
          }}
        />
        {NAV.map((item, i) => (
          <button
            key={item.label}
            ref={el => { btnRefs.current[i] = el; }}
            onClick={() => click(i, item)}
            className="relative z-10 px-4 py-1.5 text-[13px] font-medium rounded-full transition-colors duration-200"
            style={{ color: active === i ? "var(--color-ink)" : "var(--color-muted)" }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2 flex-shrink-0">
        <motion.button
          className="text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] px-3 py-2 rounded-lg transition-colors"
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/login")}
        >
          Sign In
        </motion.button>
        <motion.button
          className="btn-primary text-sm"
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/signup")}
        >
          Get Started <ChevronRight size={13} />
        </motion.button>
      </div>
    </header>
  );
}

function InvestigationCard({ inView }: { inView: boolean }) {
  const rows = [
    { label: "Customer", value: "Acme Corp", cls: "", delay: 0.1 },
    { label: "Expected discount", value: "20%", cls: "", delay: 0.2 },
    { label: "Actual discount", value: "68%", cls: "text-red-600 font-semibold", delay: 0.3 },
    { label: "Rule violated", value: "Renewal Discount Policy", cls: "", delay: 0.4 },
    { label: "Recoverable", value: "₹3.8L", cls: "text-emerald-600 font-semibold", delay: 0.5 },
  ];
  return (
    <div className="card p-5 max-w-xs w-full" style={{
      borderColor: "rgb(254 202 202)",
      boxShadow: "0 8px 32px -8px rgba(192,21,47,0.12)",
    }}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
          <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}>
            <AlertTriangle size={16} className="text-red-600" />
          </motion.div>
        </div>
        <div>
          <div className="text-sm font-bold text-[var(--color-ink)]">₹4.2L at risk</div>
          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">Unapproved 68% discount · Acme Corp renewal</div>
        </div>
      </div>
      <div className="space-y-2.5">
        {rows.map(({ label, value, cls, delay }) => (
          <motion.div key={label} className="flex items-center justify-between text-[11px]"
            initial={{ opacity: 0, x: -8 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
            transition={{ duration: 0.4, delay: inView ? delay : 0, ease: [0.22, 1, 0.36, 1] }}>
            <span className="text-[var(--color-muted)]">{label}</span>
            <span className={`font-medium text-[var(--color-ink)] ${cls}`}>{value}</span>
          </motion.div>
        ))}
      </div>
      <motion.div className="mt-4 flex items-center gap-2"
        initial={{ opacity: 0, y: 4 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
        transition={{ duration: 0.4, delay: inView ? 0.65 : 0 }}>
        <button className="flex-1 text-[11px] font-semibold py-2 rounded-lg bg-[var(--color-ink)] text-white hover:opacity-90 transition-opacity">
          Approve Recovery
        </button>
        <button className="flex-1 text-[11px] font-medium py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors">
          Escalate
        </button>
      </motion.div>
      <motion.div className="mt-3 pt-3 border-t border-[var(--color-border)] text-[10px] text-[var(--color-muted)] flex items-center gap-1.5"
        initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: inView ? 0.8 : 0, duration: 0.4 }}>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Evidence logged · Process step #14 · Invoice INV-2024-883
      </motion.div>
    </div>
  );
}

// ─── Beautiful Mock Visuals for Live Data Preview ────────────────────────────
function MockLeakageByTypeVisual() {
  const items = [
    { type: "Over Discount", leakage: "₹42.8L", recoverable: "₹38.0L", width: "90%", recWidth: "80%", color: "#6d59d0" },
    { type: "Duplicate Payment", leakage: "₹31.5L", recoverable: "₹31.5L", width: "70%", recWidth: "70%", color: "#4f46e5" },
    { type: "Missed Renewal", leakage: "₹24.2L", recoverable: "₹19.5L", width: "55%", recWidth: "44%", color: "#0284c7" },
    { type: "Invoice Overdue", leakage: "₹18.6L", recoverable: "₹14.2L", width: "42%", recWidth: "32%", color: "#059669" },
    { type: "Silent Churn", leakage: "₹12.4L", recoverable: "₹9.8L", width: "30%", recWidth: "24%", color: "#b8862e" },
  ];

  return (
    <div className="space-y-4 pt-1">
      <div className="flex items-center justify-between text-xs text-[var(--color-muted)] font-medium pb-1 border-b border-[var(--color-border)]">
        <span>Leakage Category</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[var(--color-accent)] inline-block" /> Total Leakage</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Recoverable</span>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.type} className="space-y-1">
            <div className="flex justify-between text-xs font-semibold text-[var(--color-ink)]">
              <span>{item.type}</span>
              <span className="tabular-nums"><span className="text-[var(--color-accent)]">{item.leakage}</span> / <span className="text-emerald-600">{item.recoverable}</span></span>
            </div>
            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden relative flex">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: item.width }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: idx * 0.1, ease: EASE }}
                className="h-full rounded-full relative z-10"
                style={{ background: "linear-gradient(90deg, #6d59d0 0%, #8b79e8 100%)" }}
              />
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: item.recWidth }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: idx * 0.1 + 0.1, ease: EASE }}
                className="h-full rounded-full absolute top-0 left-0 z-20 bg-emerald-500 opacity-90"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockLeakageBySeverityVisual() {
  const tiers = [
    { label: "Critical Severity", amount: "₹48.2L", pct: 41, count: 18, color: "#c0152f", bg: "bg-red-500" },
    { label: "High Severity", amount: "₹32.6L", pct: 28, count: 14, color: "#b8862e", bg: "bg-amber-500" },
    { label: "Medium Severity", amount: "₹24.0L", pct: 20, count: 10, color: "#6d59d0", bg: "bg-purple-600" },
    { label: "Low Severity", amount: "₹14.7L", pct: 11, count: 5, color: "#64748b", bg: "bg-slate-500" },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2">
      {/* SVG Donut Chart */}
      <div className="relative w-44 h-44 flex items-center justify-center flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          <circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="16" fill="transparent" />
          {/* Critical: 41% (strokeDasharray: 98, 141) */}
          <motion.circle cx="50" cy="50" r="38" stroke="#c0152f" strokeWidth="16" fill="transparent"
            strokeDasharray="98 141" strokeDashoffset="0"
            initial={{ strokeDashoffset: 239 }} whileInView={{ strokeDashoffset: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.9, ease: EASE }} />
          {/* High: 28% (strokeDasharray: 67, 172) */}
          <motion.circle cx="50" cy="50" r="38" stroke="#b8862e" strokeWidth="16" fill="transparent"
            strokeDasharray="67 172" strokeDashoffset="-98"
            initial={{ strokeDashoffset: 239 }} whileInView={{ strokeDashoffset: -98 }} viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.2, ease: EASE }} />
          {/* Medium: 20% (strokeDasharray: 48, 191) */}
          <motion.circle cx="50" cy="50" r="38" stroke="#6d59d0" strokeWidth="16" fill="transparent"
            strokeDasharray="48 191" strokeDashoffset="-165"
            initial={{ strokeDashoffset: 239 }} whileInView={{ strokeDashoffset: -165 }} viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.4, ease: EASE }} />
          {/* Low: 11% (strokeDasharray: 26, 213) */}
          <motion.circle cx="50" cy="50" r="38" stroke="#64748b" strokeWidth="16" fill="transparent"
            strokeDasharray="26 213" strokeDashoffset="-213"
            initial={{ strokeDashoffset: 239 }} whileInView={{ strokeDashoffset: -213 }} viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.6, ease: EASE }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase font-bold text-[var(--color-muted)] tracking-wider">Total</span>
          <span className="text-base font-extrabold text-[var(--color-ink)] tabular-nums">₹1.19 Cr</span>
          <span className="text-[10px] text-emerald-600 font-semibold">47 Alerts</span>
        </div>
      </div>

      {/* Legend list */}
      <div className="space-y-2.5 flex-1 w-full">
        {tiers.map((t) => (
          <div key={t.label} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100/80 transition-colors text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${t.bg}`} />
              <span className="font-semibold text-[var(--color-ink)]">{t.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--color-ink)] tabular-nums">{t.amount}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-gray-200 text-[var(--color-muted)] font-medium">{t.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STAGES = [
  { label: "Data Sources", color: "var(--color-accent)", items: ["Invoices", "Payments", "Renewals", "Customers"], Icon: Database },
  { label: "Process Twin Engine", color: "#b8862e", items: ["Process Mining", "Rules Engine", "Anomaly Detection"], Icon: GitBranch },
  { label: "Insights", color: "#c0152f", items: ["Leakage Detected", "Evidence Linked", "Root Cause"], Icon: Search },
  { label: "Outcomes", color: "#1a7a4a", items: ["Recovery Action", "Audit Trail", "Closed Loop"], Icon: Check },
];

function PipelineSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.18 });
  return (
    <section id="product" className="py-24 px-6 bg-[var(--color-surface)]">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-16">
          <div className="text-micro mb-3 text-[var(--color-accent)]">How data becomes recovery</div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-[var(--color-ink)] tracking-tight">
            The Revenue Process Twin Flow
          </h2>
          <p className="text-sm text-[var(--color-muted)] mt-3 max-w-md mx-auto leading-relaxed">
            Every rupee of leakage has a traceable path. We map it, explain it, and give you the tool to recover it.
          </p>
        </Reveal>
        <div ref={ref} className="flex flex-col md:flex-row items-stretch gap-2 md:gap-0">
          {STAGES.map((stage, i) => (
            <div key={stage.label} className="flex flex-col md:flex-row items-stretch flex-1 min-w-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ background: stage.color }}>
                    <stage.Icon size={15} />
                  </div>
                  <div className="text-xs font-bold text-[var(--color-ink)]">{stage.label}</div>
                </div>
                <div className="space-y-2">
                  {stage.items.map((item, j) => (
                    <motion.div key={item} className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]"
                      initial={{ opacity: 0, x: -6 }}
                      animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
                      transition={{ duration: 0.35, delay: i * 0.15 + j * 0.07 + 0.2 }}>
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                      {item}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
              {i < STAGES.length - 1 && (
                <motion.div initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ delay: i * 0.15 + 0.35 }}
                  className="flex items-center justify-center px-3 py-2 md:py-0 text-[var(--color-border)]">
                  <ArrowRight size={14} className="hidden md:block" />
                  <ArrowDown size={14} className="block md:hidden" />
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const DIFFS = [
  { aspect: "Approach", old: "Detect suspicious transactions", neu: "Detect process violations against defined rules" },
  { aspect: "Explanation", old: "Score-based — limited reasoning", neu: "Cites exact process step, rule broken, and evidence" },
  { aspect: "Timing", old: "Mostly retrospective", neu: "Catches leaks before they finalize" },
  { aspect: "Recovery", old: "Analytics report", neu: "One-click recovery action + workflow" },
  { aspect: "Audit", old: "Limited trail", neu: "Full tamper-evident log of every action and outcome" },
];

function DiffSection() {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        <Reveal className="text-center mb-14">
          <div className="text-micro mb-3 text-[var(--color-accent)]">Why Revenue Process Twin?</div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-[var(--color-ink)] tracking-tight">
            Detection is table stakes.<br />We explain and recover.
          </h2>
          <p className="text-sm text-[var(--color-muted)] mt-3 max-w-sm mx-auto">
            Traditional tools tell you something is wrong. We tell you why, what it cost, and exactly how to fix it.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden shadow-sm">
            <div className="grid grid-cols-3 bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
              <div className="px-5 py-3" />
              <div className="px-5 py-3 text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider border-l border-[var(--color-border)]">Traditional Tools</div>
              <div className="px-5 py-3 border-l border-[var(--color-border)] flex items-center gap-1.5">
                <img src="/logo.png" alt="" className="w-4 h-4 object-contain" />
                <span className="text-[11px] font-bold text-[var(--color-ink)] uppercase tracking-wider">Revenue Process Twin</span>
              </div>
            </div>
            {DIFFS.map((row, i) => (
              <Reveal key={row.aspect} delay={i * 0.05}>
                <div className={`grid grid-cols-3 ${i < DIFFS.length - 1 ? "border-b border-[var(--color-border)]" : ""}`}>
                  <div className="px-5 py-4 text-[12px] font-semibold text-[var(--color-ink)]">{row.aspect}</div>
                  <div className="px-5 py-4 border-l border-[var(--color-border)] flex items-start gap-2">
                    <X size={12} className="text-[var(--color-muted)] mt-0.5 flex-shrink-0" />
                    <span className="text-[12px] text-[var(--color-muted)]">{row.old}</span>
                  </div>
                  <div className="px-5 py-4 border-l border-[var(--color-border)] bg-[rgba(109,91,208,0.02)] flex items-start gap-2">
                    <Check size={12} className="text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                    <span className="text-[12px] text-[var(--color-ink)] font-medium">{row.neu}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const USE_CASES = [
  { sector: "SaaS", icon: "⚡", leaks: ["Failed renewals", "Unauthorized discounts", "Seat overages"] },
  { sector: "E-commerce", icon: "🛒", leaks: ["Duplicate refunds", "Fraudulent returns", "Payment mismatches"] },
  { sector: "Telecom", icon: "📡", leaks: ["Billing mismatches", "Rate plan violations", "Credit overrides"] },
  { sector: "Subscription", icon: "🔄", leaks: ["Silent churn", "Renewal leakage", "Tier downgrades"] },
  { sector: "Enterprise", icon: "🏢", leaks: ["Contract violations", "Discount policy breaches", "Invoice disputes"] },
];

function UseCasesSection() {
  return (
    <section className="py-24 px-6 bg-[var(--color-surface)]">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-14">
          <div className="text-micro mb-3 text-[var(--color-accent)]">Use cases</div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-[var(--color-ink)] tracking-tight">
            Revenue leaks by industry
          </h2>
          <p className="text-sm text-[var(--color-muted)] mt-3 max-w-sm mx-auto">
            The process patterns differ. The consequence is the same — preventable revenue loss.
          </p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {USE_CASES.map((uc, i) => (
            <Reveal key={uc.sector} delay={i * 0.07}>
              <div className="card p-5 cursor-default h-full"
                style={{ transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 32px -8px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "";
                }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{uc.icon}</span>
                  <div className="text-sm font-bold text-[var(--color-ink)]">{uc.sector}</div>
                </div>
                <div className="space-y-1.5">
                  {uc.leaks.map(l => (
                    <div key={l} className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { data: summaryData } = useSummary();

  const summary = summaryData ?? {
    total_leakage_rs: 98200000,
    total_recoverable_rs: 70000000,
    active_alerts: 30,
    by_leak_type: [
      { leak_type: "over_discount", leakage_rs: 6300000, recoverable_rs: 4800000, count: 14 },
      { leak_type: "duplicate_payment", leakage_rs: 5100000, recoverable_rs: 5100000, count: 8 },
      { leak_type: "missed_renewal", leakage_rs: 4200000, recoverable_rs: 3200000, count: 12 },
      { leak_type: "invoice_overdue", leakage_rs: 3800000, recoverable_rs: 2800000, count: 9 },
      { leak_type: "silent_churn", leakage_rs: 1900000, recoverable_rs: 1454181, count: 4 },
    ],
    by_severity: [
      { severity: "critical" as const, leakage_rs: 10400000, recoverable_rs: 8900000, count: 18 },
      { severity: "high" as const, leakage_rs: 7200000, recoverable_rs: 5400000, count: 15 },
      { severity: "medium" as const, leakage_rs: 3800000, recoverable_rs: 2200000, count: 10 },
      { severity: "low" as const, leakage_rs: 1344801, recoverable_rs: 854181, count: 4 },
    ],
  };

  const { ref: howRef, inView: howInView } = useInView({ triggerOnce: true, threshold: 0.15 });
  const { ref: invRef, inView: invInView } = useInView({ triggerOnce: true, threshold: 0.2 });

  const cards = [
    { icon: <AlertTriangle size={18} />, title: "₹4.2L caught", description: "Unapproved 68% discount on Acme Corp flagged before renewal executed", date: "Critical · Over-discount", iconBg: "rgba(192,21,47,0.09)", accentColor: "#c0152f" },
    { icon: <RefreshCcw size={18} />, title: "₹1.2L recovered", description: "Duplicate payment on Vertex Ltd reversed automatically by the process twin", date: "High confidence · Duplicate", iconBg: "rgba(109,91,208,0.09)", accentColor: "var(--color-accent)" },
    { icon: <TrendingDown size={18} />, title: "Churn caught early", description: "3-month revenue decline detected before Neon Retail subscription lapsed", date: "Silent churn · 71% risk score", iconBg: "rgba(184,134,46,0.09)", accentColor: "#b8862e" },
  ];

  const steps = [
    { icon: <Zap size={18} />, title: "Detect", desc: "Process mining and graph heuristics scan every invoice, payment, and renewal event for conformance breaks." },
    { icon: <BarChart2 size={18} />, title: "Explain", desc: "Every alert comes with a counterfactual: 'If X had happened instead, here is what you would have recovered.'" },
    { icon: <Shield size={18} />, title: "Recover", desc: "One-click approve actions execute recovery workflows directly — reversal, re-invoice, outreach, or escalation." },
    { icon: <FileText size={18} />, title: "Audit", desc: "Every action is logged with actor, timestamp, and outcome — full deterministic audit trail." },
  ];

  const trust = [
    { icon: <Shield size={16} />, title: "Deterministic, not a black box", desc: "Every alert cites the exact process step that broke, the rule violated, and the evidence." },
    { icon: <FileText size={16} />, title: "Every action is audited", desc: "Full tamper-evident log of who executed what, when, and with what outcome." },
    { icon: <Zap size={16} />, title: "Real Data & Instant Sync", desc: "Native connections to SQLite/Postgres and local Ollama streaming engine." },
  ];

  const metrics = [
    { label: "Leakage detected", value: summary.total_leakage_rs, isRs: true, delay: 0 },
    { label: "Recoverable", value: summary.total_recoverable_rs, isRs: true, delay: 0.1 },
    { label: "Active alerts", value: summary.active_alerts, isRs: false, delay: 0.18 },
    { label: "Leak types tracked", value: summary.by_leak_type.length, isRs: false, delay: 0.26 },
  ];

  return (
    <div id="landing-scroll" className="landing-body" style={{ height: "100vh", overflowY: "auto", overflowX: "hidden" }} data-lenis-prevent>
      <LandingNav />

      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 py-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/hero-bg.jpg" alt="" className="w-full h-full object-cover object-center" style={{ opacity: 0.28, filter: "contrast(1.1) brightness(0.95)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(248,248,250,0.60) 0%, rgba(255,255,255,0.70) 100%)" }} />
        </div>
        <HeroCanvas />
        <div className="absolute bottom-0 left-0 right-0 z-0 pointer-events-none overflow-hidden leading-none">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="w-full" style={{ height: 80 }}>
            <motion.path d="M0,40 C180,80 360,0 540,40 C720,80 900,0 1080,40 C1260,80 1440,20 1440,40 L1440,100 L0,100 Z" fill="rgba(109,91,208,0.04)"
              animate={{ d: ["M0,40 C180,80 360,0 540,40 C720,80 900,0 1080,40 C1260,80 1440,20 1440,40 L1440,100 L0,100 Z", "M0,60 C200,20 400,80 600,50 C800,20 1000,70 1200,40 C1300,25 1440,55 1440,55 L1440,100 L0,100 Z", "M0,40 C180,80 360,0 540,40 C720,80 900,0 1080,40 C1260,80 1440,20 1440,40 L1440,100 L0,100 Z"] }}
              transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }} />
            <motion.path d="M0,60 C240,20 480,90 720,60 C960,30 1200,80 1440,60 L1440,100 L0,100 Z" fill="rgba(109,91,208,0.025)"
              animate={{ d: ["M0,60 C240,20 480,90 720,60 C960,30 1200,80 1440,60 L1440,100 L0,100 Z", "M0,45 C300,75 600,25 900,55 C1100,75 1300,40 1440,45 L1440,100 L0,100 Z", "M0,60 C240,20 480,90 720,60 C960,30 1200,80 1440,60 L1440,100 L0,100 Z"] }}
              transition={{ repeat: Infinity, duration: 11, ease: "easeInOut", delay: 2 }} />
          </svg>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto pt-6">
          <motion.h1 className="font-display font-bold text-[var(--color-ink)] mb-8 leading-[1.05] tracking-tight"
            style={{ fontSize: "clamp(3.2rem, 7vw, 6.5rem)" }}
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
            Find the money<br />your business is{" "}
            <motion.em className="not-italic text-[var(--color-accent)]"
              initial={{ opacity: 0, filter: "blur(6px)" }} animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}>
              losing.
            </motion.em>
          </motion.h1>
          <motion.p className="text-lg md:text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.25, ease: EASE }}>
            Revenue Process Twin connects to your financial data, detects where the revenue process breaks, shows the financial impact, and tells you exactly what can be recovered.
          </motion.p>
          <motion.div className="flex items-center justify-center gap-4 flex-wrap"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.38, ease: EASE }}>
            <motion.button className="relative inline-flex items-center gap-2.5 bg-[var(--color-ink)] text-white font-semibold text-base px-8 py-4 rounded-full shadow-[0_8px_32px_-8px_rgba(10,10,10,0.35)] overflow-hidden"
              whileHover={{ scale: 1.04, y: -3, boxShadow: "0 16px 40px -8px rgba(10,10,10,0.45)" }} whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }} onClick={() => navigate("/signup")}>
              <motion.span className="absolute inset-0 rounded-full opacity-0"
                style={{ background: "radial-gradient(circle at 50% 50%, rgba(109,91,208,0.3), transparent 70%)" }}
                whileHover={{ opacity: 1 }} transition={{ duration: 0.3 }} />
              <span className="relative">Start Free Trial</span>
              <ArrowRight size={16} className="relative" />
            </motion.button>
            <motion.button className="inline-flex items-center gap-2 border-2 border-[var(--color-ink)]/20 text-[var(--color-ink)] font-semibold text-base px-8 py-4 rounded-full backdrop-blur-sm bg-white/60 hover:bg-white/90 hover:border-[var(--color-ink)]/40 transition-colors"
              whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }} onClick={() => navigate("/login")}>
              Sign In
            </motion.button>
            <motion.button className="text-[var(--color-muted)] text-sm font-medium underline-offset-4 hover:underline hover:text-[var(--color-ink)] transition-colors"
              onClick={() => document.getElementById("data")?.scrollIntoView({ behavior: "smooth" })}>
              See it on real data →
            </motion.button>
          </motion.div>
        </div>
        <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[var(--color-muted)] z-10"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 0.6 }}>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}>
            <ArrowDown size={16} />
          </motion.div>
        </motion.div>
      </section>

      <section className="border-y border-[var(--color-border)] bg-white py-14 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {metrics.map(({ label, value, isRs, delay }) => (
            <Reveal key={label} delay={delay}>
              <div className="font-display text-4xl font-bold text-[var(--color-ink)] tabular">
                <AnimNum value={value} prefix={isRs ? "₹" : ""} delay={delay} />
              </div>
              <div className="text-sm text-[var(--color-muted)] mt-2 font-medium">{label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="how" className="py-24 px-6 bg-[var(--color-surface)]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <div className="text-micro mb-3 text-[var(--color-accent)]">How it works</div>
              <h2 className="font-display font-bold text-3xl sm:text-5xl text-[var(--color-ink)] tracking-tight">
                Detect. Explain. Recover. Audit.
              </h2>
              <p className="text-sm text-[var(--color-muted)] mt-3 max-w-sm mx-auto">
                The full revenue-protection loop, in one dashboard.
              </p>
            </div>
          </Reveal>
          <div ref={howRef} className="grid md:grid-cols-2 gap-10 items-start">
            <div className="relative flex flex-col gap-0">
              <div className="absolute left-[22px] top-8 bottom-8 w-px bg-[var(--color-border)]" />
              <motion.div className="absolute left-[22px] top-8 w-px bg-[var(--color-accent)] origin-top"
                initial={{ scaleY: 0 }} animate={howInView ? { scaleY: 1 } : { scaleY: 0 }}
                transition={{ duration: 1.2, delay: 0.2, ease: [0.22, 1, 0.36, 1] }} style={{ height: "calc(100% - 64px)" }} />
              {steps.map((step, i) => (
                <motion.div key={step.title} className="relative flex gap-5 pb-8 last:pb-0 group"
                  initial={{ opacity: 0, x: -16 }} animate={howInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
                  transition={{ duration: 0.5, delay: i * 0.12 + 0.1, ease: [0.22, 1, 0.36, 1] }}>
                  <div className="relative z-10 w-11 h-11 rounded-xl bg-white border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] flex-shrink-0 shadow-sm group-hover:border-[var(--color-accent)] group-hover:shadow-md transition-all duration-200">
                    {step.icon}
                  </div>
                  <div className="pt-2">
                    <div className="text-base font-bold text-[var(--color-ink)] mb-1">{step.title}</div>
                    <p className="text-sm text-[var(--color-muted)] leading-relaxed">{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <div ref={invRef} className="flex flex-col items-center gap-6">
              <Reveal delay={0.2} className="w-full flex justify-center"><InvestigationCard inView={invInView} /></Reveal>
              <Reveal delay={0.35} className="flex items-center justify-center py-4 min-h-[300px]"><DisplayCards cards={cards} /></Reveal>
            </div>
          </div>
        </div>
      </section>

      <PipelineSection />

      {/* Live Data Preview Section with Custom Crisp Mock Visuals */}
      <section id="data" className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <div className="text-micro mb-3 text-[var(--color-accent)]">Live data preview</div>
              <h2 className="font-display font-bold text-3xl sm:text-5xl text-[var(--color-ink)] tracking-tight">This is the real product.</h2>
              <p className="text-sm text-[var(--color-muted)] mt-3 max-w-sm mx-auto">Interactive charts on representative data — the same engine that runs on real revenue data.</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden shadow-[var(--shadow-elevation-2)]">
              <div className="bg-[var(--color-surface-2)] px-4 py-3 flex items-center gap-2 border-b border-[var(--color-border)]">
                <div className="flex gap-1.5">
                  {["#ffbd2e", "#ff6058", "#27c93f"].map(c => <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
                </div>
                <div className="flex-1 bg-white rounded border border-[var(--color-border)] text-[10px] text-[var(--color-muted)] text-center py-1">revenue-process-twin.local/app</div>
              </div>
              <div className="p-6 bg-white grid md:grid-cols-2 gap-6">
                <div className="card p-5 border border-gray-200/80 bg-white shadow-xs">
                  <div className="text-sm font-bold text-[var(--color-ink)] mb-4">Leakage by Type</div>
                  <MockLeakageByTypeVisual />
                </div>
                <div className="card p-5 border border-gray-200/80 bg-white shadow-xs">
                  <div className="text-sm font-bold text-[var(--color-ink)] mb-4">Leakage by Severity</div>
                  <MockLeakageBySeverityVisual />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <DiffSection />
      <UseCasesSection />

      <section className="py-20 px-6 bg-white border-t border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          {trust.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.08}>
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-muted)] flex-shrink-0">{t.icon}</div>
                <div>
                  <div className="text-sm font-semibold text-[var(--color-ink)] mb-1">{t.title}</div>
                  <p className="text-xs text-[var(--color-muted)] leading-relaxed">{t.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="py-24 px-6" style={{ background: "var(--color-black)" }}>
        <Reveal>
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-micro text-white/40 mb-6">Revenue Process Twin</div>
            <h2 className="font-display font-bold text-white mb-4 leading-[1.08] tracking-tight" style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)" }}>
              Revenue leakage doesn't{" "}
              <em className="not-italic text-[var(--color-accent-300)]">announce itself.</em>
              <br />Your process should.
            </h2>
            <p className="text-sm text-white/45 mb-3 font-medium tracking-wide">Detect it. Explain it. Recover it.</p>
            <p className="text-xs text-white/30 mb-10 max-w-sm mx-auto">Set up your workspace in minutes. No credit card required.</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <motion.button className="inline-flex items-center gap-2.5 bg-white text-[var(--color-black)] font-semibold text-sm px-8 py-3.5 rounded-full hover:bg-[var(--color-surface)] transition-colors shadow-lg"
                whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => navigate("/signup")}>
                Create Free Account <ArrowRight size={14} />
              </motion.button>
              <motion.button className="inline-flex items-center gap-2.5 border border-white/20 text-white/70 font-medium text-sm px-7 py-3.5 rounded-full hover:bg-white/10 transition-colors"
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }} onClick={() => navigate("/login")}>
                Sign In
              </motion.button>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-[rgba(255,255,255,0.06)] py-8 px-8 flex items-center justify-between bg-[var(--color-black)]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden p-0.5">
            <img src="/logo.png" alt="Revenue Process Twin" className="w-full h-full object-contain opacity-80" />
          </div>
          <span className="text-xs font-semibold text-white/50">Revenue Process Twin</span>
        </div>
        <div className="flex items-center gap-5 text-xs text-white/30">
          <a href="mailto:demo@revenueguard.demo" className="hover:text-white/60 transition-colors">Contact</a>
          <span>Process Twin Demo</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}