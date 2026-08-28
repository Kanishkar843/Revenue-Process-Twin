import { motion, AnimatePresence } from "framer-motion";
import { getFadeUp } from "../../lib/motion";

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | number;
  label?: string;
}

export function LoadingSpinner({ size = "md", label }: SpinnerProps) {
  const dim = typeof size === "number" ? `${size}px` : size === "sm" ? "16px" : size === "lg" ? "28px" : "20px";
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="spinner" style={{ width: dim, height: dim }} />
      {label && <span className="text-sm text-[var(--color-muted)]">{label}</span>}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" label="Loading…" />
    </div>
  );
}

/** Skeleton card placeholder */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="skeleton h-3 w-24 rounded" />
      <div className="skeleton h-7 w-36 rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-2.5 rounded" style={{ width: `${70 + i * 8}%` }} />
      ))}
    </div>
  );
}

/** Skeleton KPI bar */
export function SkeletonKpis() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card-kpi p-5 flex flex-col gap-3">
          <div className="skeleton h-2.5 w-20 rounded" />
          <div className="skeleton h-8 w-28 rounded" />
          <div className="skeleton h-2 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const fadeUp = getFadeUp();
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-64 gap-4"
      {...fadeUp}
    >
      <div className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-lg">⚠</div>
      <p className="text-sm text-[var(--color-muted)] text-center max-w-xs">
        {message ?? "Something went wrong. Please try again."}
      </p>
      {onRetry && (
        <button className="btn-ghost text-xs" onClick={onRetry}>
          Retry
        </button>
      )}
    </motion.div>
  );
}

export function EmptyState({ message }: { message?: string }) {
  const fadeUp = getFadeUp();
  return (
    <AnimatePresence>
      <motion.div
        className="flex flex-col items-center justify-center h-48 gap-2"
        {...fadeUp}
      >
        <div className="text-2xl text-[var(--color-border-strong)]">—</div>
        <p className="text-sm text-[var(--color-muted)]">
          {message ?? "No data found."}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
