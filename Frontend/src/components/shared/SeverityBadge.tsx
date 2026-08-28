/** Severity badge — dot + label, semantic colors (§5.3) */
export function SeverityBadge({
  severity,
}: {
  severity: "critical" | "high" | "medium" | "low";
}) {
  const cls = {
    critical: "badge badge-critical",
    high:     "badge badge-high",
    medium:   "badge badge-medium",
    low:      "badge badge-low",
  }[severity] ?? "badge badge-low";

  const labels = {
    critical: "Critical",
    high:     "High",
    medium:   "Medium",
    low:      "Low",
  };

  return <span className={cls}>{labels[severity] ?? severity}</span>;
}

/** Status badge */
export function StatusBadge({
  status,
}: {
  status: "open" | "acknowledged" | "resolved";
}) {
  const cls = {
    open:         "badge badge-open",
    acknowledged: "badge badge-acknowledged",
    resolved:     "badge badge-resolved",
  }[status] ?? "badge badge-open";

  const labels = {
    open:         "Open",
    acknowledged: "Acknowledged",
    resolved:     "Resolved",
  };

  return <span className={cls}>{labels[status] ?? status}</span>;
}
