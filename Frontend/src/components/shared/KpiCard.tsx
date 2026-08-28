import { motion } from "framer-motion";
import { getCardHover, getFadeUp } from "../../lib/motion";

interface Props {
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
  icon?: React.ReactNode;
  delay?: number;
}

export function KpiCard({ title, value, sub, accent, icon, delay = 0 }: Props) {
  const fadeUp = getFadeUp();
  const cardHover = getCardHover();

  return (
    <motion.div
      className="card-kpi p-5 flex flex-col gap-2 min-w-0"
      variants={fadeUp}
      {...cardHover}
      style={{ originY: 0 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-micro">{title}</span>
        {icon && (
          <span className="text-[var(--color-muted)]">{icon}</span>
        )}
      </div>
      <div
        className={`text-2xl font-bold tabular leading-none font-display ${
          accent ? "text-[var(--color-accent)]" : "text-[var(--color-ink)]"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="text-xs text-[var(--color-muted)]">{sub}</div>
      )}
    </motion.div>
  );
}
