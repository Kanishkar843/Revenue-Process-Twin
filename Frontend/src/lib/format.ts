/**
 * lib/format.ts — Single source of truth for all currency/date/number formatting.
 * NEVER do currency math with floats. _rs fields are integer rupees.
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Format integer rupees → ₹1,00,000 */
export function formatINR(value: number): string {
  return inrFormatter.format(value);
}

/** Format integer rupees in short form: ₹4.2L, ₹1.2Cr */
export function formatINRShort(value: number): string {
  if (value >= 10_000_000) {
    return `₹${(value / 10_000_000).toFixed(1)}Cr`;
  }
  if (value >= 100_000) {
    return `₹${(value / 100_000).toFixed(1)}L`;
  }
  if (value >= 1_000) {
    return `₹${(value / 1_000).toFixed(0)}K`;
  }
  return `₹${value}`;
}

/** Format 0-1 float as percentage (e.g. 0.35 → "35%") */
export function formatPct(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format 0-100 score as integer */
export function formatScore(value: number): string {
  return Math.round(value).toString();
}

/** ISO string → locale date string */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** ISO string → locale date + time */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Capitalise and replace underscores with spaces */
export function formatLabel(str: string): string {
  return str
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
