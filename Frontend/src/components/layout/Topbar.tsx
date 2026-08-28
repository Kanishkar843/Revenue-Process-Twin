import { useNavigate } from "react-router-dom";
import { useHealth } from "../../hooks/useHealth";
import { Sparkles } from "lucide-react";

interface Props {
  title: string;
}

function HealthIndicator() {
  const { data, isLoading } = useHealth();

  let isOk = data?.status === "ok";
  let label = isLoading ? "Syncing..." : isOk ? "Engine Active (3.12ms)" : "Degraded";

  return (
    <div className="flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/80 px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] shadow-sm backdrop-blur-md">
      <span
        className={`h-2 w-2 rounded-full ${isLoading
            ? "bg-amber-400 animate-pulse"
            : isOk
              ? "bg-[#22c55e] shadow-[0_0_6px_rgba(34,197,94,0.5)]"
              : "bg-red-500"
          }`}
      />
      <span className="hidden sm:inline text-[11px] font-mono">{label}</span>
    </div>
  );
}

export function Topbar({ title }: Props) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between px-4 sm:px-8 border-b border-black/[0.04] bg-[#f8f9fb]/80 backdrop-blur-xl transition-all">
      {/* Left: Breadcrumbs & Mobile Logo */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-black/[0.08] shadow-sm overflow-hidden p-1"
          onClick={() => navigate("/")}
          aria-label="Home"
        >
          <img
            src="/logo.png"
            alt="Revenue Process Twin"
            className="w-full h-full object-contain"
          />
        </button>

        <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <span className="hidden sm:inline text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Revenue Process Twin
          </span>
          <span className="hidden sm:inline text-black/20">/</span>
          <h1 className="text-sm font-semibold text-[var(--color-ink)] truncate font-display">
            {title}
          </h1>
        </div>
      </div>

      {/* Right: Quick Context, Engine Health, Actions */}
      <div className="flex items-center gap-3">
        <HealthIndicator />

        <button
          onClick={() => navigate("/chat")}
          className="hidden sm:flex items-center gap-1.5 rounded-full bg-black/[0.04] hover:bg-black/[0.07] px-3 py-1 text-xs font-medium text-[var(--color-text)] transition-colors"
        >
          <Sparkles size={13} className="text-[var(--color-accent)]" />
          <span>Ask Narrator</span>
        </button>
      </div>
    </header>
  );
}
