import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, TrendingDown, BadgeDollarSign, Activity } from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { KpiCard } from "../components/shared/KpiCard";
import { SeverityBadge } from "../components/shared/SeverityBadge";
import { MoneyValue } from "../components/shared/MoneyValue";
import { SkeletonKpis, SkeletonCard, ErrorState } from "../components/shared/LoadingSpinner";
import { LeakageByTypeChart } from "../components/charts/LeakageByTypeChart";
import { SeverityDonutChart } from "../components/charts/SeverityDonutChart";
import { TrendAreaChart } from "../components/charts/TrendAreaChart";
import { CalendarHeatmapChart } from "../components/charts/CalendarHeatmapChart";
import { MiniGauge } from "../components/charts/RiskGaugeChart";
import { useSummary } from "../hooks/useSummary";
import { useAlerts } from "../hooks/useAlerts";
import { formatINRShort, formatDate } from "../lib/format";
import { useCountUp } from "../lib/useCountUp";
import { getFadeUp, staggerContainer } from "../lib/motion";
import type { RecoverableSummary } from "../types/interfaces";

function AnimatedMoney({ value, accent }: { value: number; accent?: boolean }) {
  const count = useCountUp(value);
  return <MoneyValue value={count} accent={accent} />;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: summary, isLoading: sLoading, error: sError } = useSummary();
  const { data: alertsResp, isLoading: aLoading } = useAlerts();

  const isLoading = sLoading || aLoading;
  const fadeUp = getFadeUp();

  // Derive trend data — use trend_60d if available, else trend_30d
  const trendData = (summary as (RecoverableSummary & { trend_60d?: RecoverableSummary["trend_30d"] }) | undefined)?.trend_60d
    ?? summary?.trend_30d
    ?? [];

  return (
    <PageShell title="Dashboard">
      {isLoading && (
        <div className="flex flex-col gap-6">
          <SkeletonKpis />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SkeletonCard rows={4} />
            <SkeletonCard rows={4} />
          </div>
          <SkeletonCard rows={3} />
        </div>
      )}
      {!isLoading && sError && <ErrorState message="Failed to load summary data." />}
      {!isLoading && summary && (
        <motion.div
          className="flex flex-col gap-6"
          variants={staggerContainer(0.06)}
          initial="initial"
          animate="animate"
        >
          {/* KPI bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total Leakage"
              value={<AnimatedMoney value={summary.total_leakage_rs} />}
              sub={`Across ${summary.by_leak_type.length} leak types`}
              icon={<TrendingDown size={14} />}
            />
            <KpiCard
              title="Total Recoverable"
              value={<AnimatedMoney value={summary.total_recoverable_rs} accent />}
              sub={`${Math.round((summary.total_recoverable_rs / summary.total_leakage_rs) * 100)}% recovery rate`}
              icon={<BadgeDollarSign size={14} />}
              accent
            />
            <KpiCard
              title="Active Alerts"
              value={<span className="tabular font-display">{summary.active_alerts}</span>}
              sub="Requiring attention"
              icon={<AlertTriangle size={14} />}
            />
            {/* Avg Risk Score — dedicated layout with fixed gauge */}
            <motion.div
              variants={fadeUp}
              className="card-kpi p-5 flex flex-col min-w-0"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-micro">Avg Risk Score</span>
                <Activity size={14} className="text-[var(--color-muted)]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold tabular font-display text-[var(--color-ink)]">
                  {summary.avg_risk_score}
                </span>
              </div>
              <div className="mt-auto">
                <MiniGauge value={summary.avg_risk_score} />
              </div>
              <div className="text-xs text-[var(--color-muted)] -mt-1">Out of 100</div>
            </motion.div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div variants={fadeUp} className="card p-5">
              <h2 className="text-h3 text-[var(--color-ink)] mb-4">Leakage by Type</h2>
              <LeakageByTypeChart data={summary.by_leak_type} />
            </motion.div>
            <motion.div variants={fadeUp} className="card p-5">
              <h2 className="text-h3 text-[var(--color-ink)] mb-4">Leakage by Severity</h2>
              <SeverityDonutChart data={summary.by_severity} />
            </motion.div>
          </div>

          {/* Trend chart + calendar heatmap */}
          <motion.div variants={fadeUp} className="card p-5">
            <h2 className="text-h3 text-[var(--color-ink)] mb-1">Leakage Trend</h2>
            <p className="text-xs text-[var(--color-muted)] mb-4">
              Leakage vs recoverable · 7-day rolling recovery rate overlay
            </p>
            <TrendAreaChart data={trendData.slice(-30)} />
          </motion.div>

          {/* Calendar heatmap */}
          {trendData.length > 0 && (
            <motion.div variants={fadeUp} className="card p-5">
              <h2 className="text-h3 text-[var(--color-ink)] mb-1">Daily Leakage Intensity</h2>
              <p className="text-xs text-[var(--color-muted)] mb-4">
                Darker cells = higher daily leakage. Hover for exact amount.
              </p>
              <CalendarHeatmapChart data={trendData} />
            </motion.div>
          )}

          {/* Recent alerts feed */}
          <motion.div variants={fadeUp} className="card">
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="text-h3 text-[var(--color-ink)]">Recent Alerts</h2>
              <button className="btn-ghost text-xs" onClick={() => navigate("/alerts")}>
                View all →
              </button>
            </div>
            {!alertsResp?.alerts?.length ? (
              <div className="p-6 text-center text-sm text-[var(--color-muted)]">No alerts</div>
            ) : (
              <div data-lenis-prevent>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Leak Type</th>
                      <th>Severity</th>
                      <th className="text-right">Leakage</th>
                      <th className="text-right">Recoverable</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertsResp.alerts.slice(0, 7).map((alert) => (
                      <tr
                        key={alert.alert_id}
                        onClick={() => navigate(`/customer/${alert.customer_id}`)}
                        tabIndex={0}
                        onKeyDown={e => e.key === "Enter" && navigate(`/customer/${alert.customer_id}`)}
                      >
                        <td>
                          <div className="font-medium">{alert.customer_name}</div>
                          <div className="text-xs text-[var(--color-muted)]">{alert.alert_id}</div>
                        </td>
                        <td className="text-[var(--color-text-secondary)]">
                          {alert.leak_type.replace(/_/g, " ")}
                        </td>
                        <td><SeverityBadge severity={alert.severity} /></td>
                        <td className="text-right"><MoneyValue value={alert.leak_amount_rs} /></td>
                        <td className="text-right"><MoneyValue value={alert.recoverable_rs} accent /></td>
                        <td className="text-[var(--color-muted)] text-xs">{formatDate(alert.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Severity summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summary.by_severity.map((s, i) => (
              <motion.div key={s.severity} variants={fadeUp} className="card p-4">
                <SeverityBadge severity={s.severity} />
                <div className="mt-2 text-xs text-[var(--color-muted)]">{s.count} alerts</div>
                <div className="mt-1 text-sm font-semibold tabular font-display">
                  {formatINRShort(s.leakage_rs)}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </PageShell>
  );
}
