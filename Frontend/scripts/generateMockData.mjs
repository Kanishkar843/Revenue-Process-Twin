/**
 * scripts/generateMockData.mjs
 * Generates an expanded mock_api.json with:
 *   - 75 alerts across 28 unique customers
 *   - 12 customers with full risk+explain payloads
 *   - 60-day trend
 *   - Internally consistent summary totals
 *   - 6 chat canned responses
 *   - 14 audit log entries
 * 
 * Run: node scripts/generateMockData.mjs
 * Output: src/mocks/mock_api.json
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Helpers ──────────────────────────────────────────────────
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

let rand = rng(42);

function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function randFloat(min, max, decimals = 2) {
  return parseFloat((rand() * (max - min) + min).toFixed(decimals));
}

function isoDate(daysAgo) {
  const d = new Date("2026-08-27T00:00:00Z");
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().replace("T00:00:00.000Z", "T") +
    `${String(randInt(8, 18)).padStart(2, "0")}:${String(randInt(0, 59)).padStart(2, "0")}:00Z`;
}

function isoDay(daysAgo) {
  const d = new Date("2026-08-27T00:00:00Z");
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

// ── Customers ─────────────────────────────────────────────────
const customers = [
  // Hero 4 from original
  { id: "CUST-0042", name: "Acme Corp" },
  { id: "CUST-0108", name: "Vertex Ltd" },
  { id: "CUST-0077", name: "Neon Retail" },
  { id: "CUST-0031", name: "BlueStar Industries" },
  // Additional 24
  { id: "CUST-1005", name: "Nimbus Retail" },
  { id: "CUST-1006", name: "Orion Traders" },
  { id: "CUST-1007", name: "Kavya Textiles" },
  { id: "CUST-1008", name: "Sundar Logistics" },
  { id: "CUST-1009", name: "Pixel Works" },
  { id: "CUST-1010", name: "Maple SaaS" },
  { id: "CUST-1011", name: "Coral Freight" },
  { id: "CUST-1012", name: "Zenith Foods" },
  { id: "CUST-1013", name: "Ashoka Traders" },
  { id: "CUST-1014", name: "Bright Path Edu" },
  { id: "CUST-1015", name: "Deccan Motors" },
  { id: "CUST-1016", name: "Everest Consulting" },
  { id: "CUST-1017", name: "Falcon Analytics" },
  { id: "CUST-1018", name: "Greenline Farms" },
  { id: "CUST-1019", name: "Harbor Steel" },
  { id: "CUST-1020", name: "Indus Pharma" },
  { id: "CUST-1021", name: "Jet Commerce" },
  { id: "CUST-1022", name: "Kiran Networks" },
  { id: "CUST-1023", name: "Lotus Healthcare" },
  { id: "CUST-1024", name: "Metro Print" },
  { id: "CUST-1025", name: "Nova Constructions" },
  { id: "CUST-1026", name: "Omega Fintech" },
  { id: "CUST-1027", name: "Prism Apparel" },
  { id: "CUST-1028", name: "Quest Robotics" },
];

const leakTypes = [
  "over_discount",
  "duplicate_payment",
  "silent_churn",
  "contract_less_discount",
  "refund_abuse",
  "overdue_invoice",
  "chargeback_pattern",
  "missed_invoice",
];

const severities = ["critical", "high", "medium", "low"];
const statuses = ["open", "acknowledged", "resolved"];

const ruleIds = [
  "R01","R02","R03","R04","R05","R06","R07","R08","R09","R10","R11",
  "GF01","GF02","GF03","GF04","GF05","GF06","GF07","GF08",
  "GH01","GH02","GH03","GH04","GH05",
];

const leakTypeRules = {
  over_discount: ["GF02","R03"],
  duplicate_payment: ["GF05","R02","GH03"],
  silent_churn: ["GF08","R09","GH05"],
  contract_less_discount: ["GF06","R11"],
  refund_abuse: ["R04"],
  overdue_invoice: ["R01"],
  chargeback_pattern: ["R10"],
  missed_invoice: ["R07"],
};

const recommendedActions = {
  over_discount: "Normalize discount to plan median",
  duplicate_payment: "Reverse duplicate payment at processor",
  silent_churn: "Trigger retention outreach after 2nd consecutive decline month",
  contract_less_discount: "Attach contract_ref or claw back unapproved discount",
  refund_abuse: "Enforce 15% lifetime refund threshold policy",
  overdue_invoice: "Reissue invoice + send reminder within 5 days",
  chargeback_pattern: "Escalate to fraud review",
  missed_invoice: "Issue missing invoice immediately",
};

const processBreaks = {
  over_discount: { step: "DISCOUNT_APPLIED", expected: "DISCOUNT_APPROVED", actual: "INVOICE_ISSUED" },
  duplicate_payment: { step: "PAYMENT_SUCCEEDED", expected: null, actual: "PAYMENT_SUCCEEDED (duplicate)" },
  silent_churn: { step: "USAGE_DECLINE_FLAGGED", expected: "CHURN_RISK_FLAG", actual: "RENEWAL_MISSED" },
  contract_less_discount: { step: "DISCOUNT_APPLIED", expected: "CONTRACT_REF_ATTACHED", actual: "INVOICE_ISSUED" },
  refund_abuse: { step: null, expected: null, actual: null },
  overdue_invoice: { step: null, expected: null, actual: null },
  chargeback_pattern: { step: null, expected: null, actual: null },
  missed_invoice: { step: null, expected: null, actual: null },
};

// Severity → leak amount ranges (in rupees)
const severityLeakRanges = {
  critical: [200000, 600000],
  high:     [60000,  220000],
  medium:   [15000,  60000],
  low:      [5000,   15000],
};

// Severity → recovery rate ranges
const recoveryRates = {
  critical: [0.65, 0.85],
  high:     [0.50, 0.90],
  medium:   [0.40, 0.75],
  low:      [0.30, 0.60],
};

// ── Generate alerts ───────────────────────────────────────────
const alerts = [];

// Original 19 alerts from seed (keeping exactly as-is)
const originalAlerts = [
  {
    alert_id: "ALT-00001", customer_id: "CUST-0042", customer_name: "Acme Corp",
    rule_id: "GF02", leak_type: "over_discount", severity: "critical",
    leak_amount_rs: 420000, recoverable_rs: 315000,
    process_break_step: "DISCOUNT_APPLIED", expected_next: "DISCOUNT_APPROVED", actual_next: "INVOICE_ISSUED",
    recommended_action: "Normalize discount from 68% to 12% plan median",
    status: "open", created_at: "2026-08-20T10:15:00Z"
  },
  {
    alert_id: "ALT-00002", customer_id: "CUST-0108", customer_name: "Vertex Ltd",
    rule_id: "GF05", leak_type: "duplicate_payment", severity: "high",
    leak_amount_rs: 120000, recoverable_rs: 120000,
    process_break_step: "PAYMENT_SUCCEEDED", expected_next: null, actual_next: "PAYMENT_SUCCEEDED (duplicate)",
    recommended_action: "Reverse duplicate payment on INV-2203",
    status: "open", created_at: "2026-08-19T09:02:00Z"
  },
  {
    alert_id: "ALT-00003", customer_id: "CUST-0077", customer_name: "Neon Retail",
    rule_id: "GF08", leak_type: "silent_churn", severity: "high",
    leak_amount_rs: 210000, recoverable_rs: 52500,
    process_break_step: "USAGE_DECLINE_FLAGGED", expected_next: "CHURN_RISK_FLAG", actual_next: "RENEWAL_MISSED",
    recommended_action: "Trigger retention outreach after 2nd consecutive decline month",
    status: "acknowledged", created_at: "2026-08-15T14:40:00Z"
  },
  {
    alert_id: "ALT-00004", customer_id: "CUST-0031", customer_name: "BlueStar Industries",
    rule_id: "GF06", leak_type: "contract_less_discount", severity: "medium",
    leak_amount_rs: 45000, recoverable_rs: 31500,
    process_break_step: "DISCOUNT_APPLIED", expected_next: "CONTRACT_REF_ATTACHED", actual_next: "INVOICE_ISSUED",
    recommended_action: "Attach contract_ref or claw back unapproved discount",
    status: "open", created_at: "2026-08-22T11:20:00Z"
  },
  {
    alert_id: "ALT-00005", customer_id: "CUST-1005", customer_name: "Nimbus Retail",
    rule_id: "R11", leak_type: "contract_less_discount", severity: "medium",
    leak_amount_rs: 15000, recoverable_rs: 10500,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Attach contract_ref or claw back discount",
    status: "open", created_at: "2026-08-22T12:15:00Z"
  },
  {
    alert_id: "ALT-00006", customer_id: "CUST-1006", customer_name: "Orion Traders",
    rule_id: "R04", leak_type: "refund_abuse", severity: "medium",
    leak_amount_rs: 32000, recoverable_rs: 16000,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Enforce 15% lifetime refund threshold policy",
    status: "open", created_at: "2026-08-21T18:47:00Z"
  },
  {
    alert_id: "ALT-00007", customer_id: "CUST-1007", customer_name: "Kavya Textiles",
    rule_id: "R09", leak_type: "silent_churn", severity: "medium",
    leak_amount_rs: 15000, recoverable_rs: 3750,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Trigger retention outreach",
    status: "resolved", created_at: "2026-08-20T14:02:00Z"
  },
  {
    alert_id: "ALT-00008", customer_id: "CUST-1008", customer_name: "Sundar Logistics",
    rule_id: "R01", leak_type: "overdue_invoice", severity: "medium",
    leak_amount_rs: 15000, recoverable_rs: 4950,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Reissue invoice + send reminder within 5 days",
    status: "open", created_at: "2026-08-19T11:32:00Z"
  },
  {
    alert_id: "ALT-00009", customer_id: "CUST-1009", customer_name: "Pixel Works",
    rule_id: "R10", leak_type: "chargeback_pattern", severity: "low",
    leak_amount_rs: 8000, recoverable_rs: 2800,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Escalate to fraud review",
    status: "resolved", created_at: "2026-08-18T11:45:00Z"
  },
  {
    alert_id: "ALT-00010", customer_id: "CUST-1010", customer_name: "Maple SaaS",
    rule_id: "R11", leak_type: "contract_less_discount", severity: "critical",
    leak_amount_rs: 310000, recoverable_rs: 217000,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Attach contract_ref or claw back discount",
    status: "acknowledged", created_at: "2026-08-17T11:28:00Z"
  },
  {
    alert_id: "ALT-00011", customer_id: "CUST-1011", customer_name: "Coral Freight",
    rule_id: "R10", leak_type: "chargeback_pattern", severity: "high",
    leak_amount_rs: 65000, recoverable_rs: 22750,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Escalate to fraud review",
    status: "open", created_at: "2026-08-16T10:44:00Z"
  },
  {
    alert_id: "ALT-00012", customer_id: "CUST-1012", customer_name: "Zenith Foods",
    rule_id: "R07", leak_type: "missed_invoice", severity: "high",
    leak_amount_rs: 90000, recoverable_rs: 40500,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Issue missing invoice immediately",
    status: "open", created_at: "2026-08-15T10:13:00Z"
  },
  {
    alert_id: "ALT-00013", customer_id: "CUST-1013", customer_name: "Ashoka Traders",
    rule_id: "GH03", leak_type: "duplicate_payment", severity: "high",
    leak_amount_rs: 90000, recoverable_rs: 90000,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Reverse duplicate payment at processor",
    status: "open", created_at: "2026-08-14T09:24:00Z"
  },
  {
    alert_id: "ALT-00014", customer_id: "CUST-1014", customer_name: "Bright Path Edu",
    rule_id: "R02", leak_type: "duplicate_payment", severity: "high",
    leak_amount_rs: 90000, recoverable_rs: 90000,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Reverse duplicate payment",
    status: "open", created_at: "2026-08-13T17:16:00Z"
  },
  {
    alert_id: "ALT-00015", customer_id: "CUST-1015", customer_name: "Deccan Motors",
    rule_id: "GH03", leak_type: "duplicate_payment", severity: "low",
    leak_amount_rs: 8000, recoverable_rs: 8000,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Reverse duplicate payment at processor",
    status: "acknowledged", created_at: "2026-08-12T16:07:00Z"
  },
  {
    alert_id: "ALT-00016", customer_id: "CUST-1016", customer_name: "Everest Consulting",
    rule_id: "R07", leak_type: "missed_invoice", severity: "medium",
    leak_amount_rs: 15000, recoverable_rs: 6750,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Issue missing invoice immediately",
    status: "resolved", created_at: "2026-08-11T12:53:00Z"
  },
  {
    alert_id: "ALT-00017", customer_id: "CUST-1017", customer_name: "Falcon Analytics",
    rule_id: "R11", leak_type: "contract_less_discount", severity: "high",
    leak_amount_rs: 90000, recoverable_rs: 62999,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Attach contract_ref or claw back discount",
    status: "resolved", created_at: "2026-08-10T11:45:00Z"
  },
  {
    alert_id: "ALT-00018", customer_id: "CUST-1018", customer_name: "Greenline Farms",
    rule_id: "R02", leak_type: "duplicate_payment", severity: "low",
    leak_amount_rs: 8000, recoverable_rs: 8000,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Reverse duplicate payment",
    status: "open", created_at: "2026-08-09T12:05:00Z"
  },
  {
    alert_id: "ALT-00019", customer_id: "CUST-1019", customer_name: "Harbor Steel",
    rule_id: "GH05", leak_type: "silent_churn", severity: "medium",
    leak_amount_rs: 48000, recoverable_rs: 12000,
    process_break_step: null, expected_next: null, actual_next: null,
    recommended_action: "Multi-hop churn intervention",
    status: "open", created_at: "2026-08-08T14:17:00Z"
  },
];

alerts.push(...originalAlerts);

// Generate additional 56 alerts (ALT-00020 to ALT-00075)
for (let i = 20; i <= 75; i++) {
  const cust = pick(customers);
  const lt = pick(leakTypes);
  const sev = pick(severities);
  const [minL, maxL] = severityLeakRanges[sev];
  const [minR, maxR] = recoveryRates[sev];
  const leakAmt = randInt(minL, maxL);
  const recAmt = Math.round(leakAmt * randFloat(minR, maxR));
  const pb = processBreaks[lt];
  const rules = leakTypeRules[lt];
  const daysAgo = randInt(1, 59);

  alerts.push({
    alert_id: `ALT-000${String(i).padStart(2, "0")}`,
    customer_id: cust.id,
    customer_name: cust.name,
    rule_id: pick(rules),
    leak_type: lt,
    severity: sev,
    leak_amount_rs: leakAmt,
    recoverable_rs: recAmt,
    process_break_step: pb.step,
    expected_next: pb.expected,
    actual_next: pb.actual,
    recommended_action: recommendedActions[lt],
    status: pick(statuses),
    created_at: isoDate(daysAgo),
  });
}

// Sort alerts by created_at descending
alerts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
// Re-number to maintain order
alerts.forEach((a, i) => {
  a.alert_id = `ALT-${String(i + 1).padStart(5, "0")}`;
});

// ── Compute summary aggregates ────────────────────────────────
const byLeakTypeMap = {};
const bySeverityMap = {};

for (const a of alerts) {
  // by leak type
  if (!byLeakTypeMap[a.leak_type]) {
    byLeakTypeMap[a.leak_type] = { leak_type: a.leak_type, leakage_rs: 0, recoverable_rs: 0, count: 0 };
  }
  byLeakTypeMap[a.leak_type].leakage_rs += a.leak_amount_rs;
  byLeakTypeMap[a.leak_type].recoverable_rs += a.recoverable_rs;
  byLeakTypeMap[a.leak_type].count++;

  // by severity
  if (!bySeverityMap[a.severity]) {
    bySeverityMap[a.severity] = { severity: a.severity, leakage_rs: 0, recoverable_rs: 0, count: 0 };
  }
  bySeverityMap[a.severity].leakage_rs += a.leak_amount_rs;
  bySeverityMap[a.severity].recoverable_rs += a.recoverable_rs;
  bySeverityMap[a.severity].count++;
}

const byLeakType = Object.values(byLeakTypeMap);
const bySeverity = ["critical","high","medium","low"]
  .filter(s => bySeverityMap[s])
  .map(s => bySeverityMap[s]);

const totalLeakage = alerts.reduce((s, a) => s + a.leak_amount_rs, 0);
const totalRecoverable = alerts.reduce((s, a) => s + a.recoverable_rs, 0);
const activeAlerts = alerts.filter(a => a.status === "open").length;

// ── Generate 60-day trend ─────────────────────────────────────
// Spread alerts across days to create correlated spikes
const trendMap = {};
for (let d = 59; d >= 0; d--) {
  trendMap[isoDay(d)] = { date: isoDay(d), leakage_rs: 0, recoverable_rs: 0 };
}

// Base random noise
rand = rng(99);
for (const day of Object.keys(trendMap)) {
  trendMap[day].leakage_rs += randInt(25000, 90000);
  trendMap[day].recoverable_rs += randInt(15000, 55000);
}

// Correlate alert amounts to dates (spike on alert days)
for (const a of alerts) {
  const day = a.created_at.split("T")[0];
  if (trendMap[day]) {
    trendMap[day].leakage_rs += Math.round(a.leak_amount_rs * 0.4);
    trendMap[day].recoverable_rs += Math.round(a.recoverable_rs * 0.4);
  }
}

const trend60d = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

// ── Customer Risk (12 customers) ──────────────────────────────
const customersRisk = {
  "CUST-0042": {
    customer_id: "CUST-0042", customer_name: "Acme Corp",
    risk_score: 78, conformance_deviation_score: 0.62, churn_probability: 0.35,
    contributing_factors: [
      { factor: "GF02 discount approval gate violated", weight: 0.4 },
      { factor: "3 invoices over plan median discount", weight: 0.22 },
      { factor: "Approver AP-03 discount cluster (GH01)", weight: 0.15 },
    ],
  },
  "CUST-0108": {
    customer_id: "CUST-0108", customer_name: "Vertex Ltd",
    risk_score: 64, conformance_deviation_score: 0.48, churn_probability: 0.2,
    contributing_factors: [
      { factor: "GF05 duplicate payment guard violated", weight: 0.45 },
      { factor: "Duplicate payment structure (GH03)", weight: 0.3 },
    ],
  },
  "CUST-0077": {
    customer_id: "CUST-0077", customer_name: "Neon Retail",
    risk_score: 82, conformance_deviation_score: 0.55, churn_probability: 0.71,
    contributing_factors: [
      { factor: "GF08 revenue continuity breached (3mo decline)", weight: 0.35 },
      { factor: "Renewal missed after usage decline (GH05)", weight: 0.3 },
      { factor: "XGBoost churn propensity high", weight: 0.28 },
    ],
  },
  "CUST-0031": {
    customer_id: "CUST-0031", customer_name: "BlueStar Industries",
    risk_score: 41, conformance_deviation_score: 0.3, churn_probability: 0.12,
    contributing_factors: [
      { factor: "GF06 enterprise contract gate violated", weight: 0.5 },
      { factor: "R11 contract-less discount policy violation", weight: 0.3 },
    ],
  },
  "CUST-1020": {
    customer_id: "CUST-1020", customer_name: "Indus Pharma",
    risk_score: 91, conformance_deviation_score: 0.78, churn_probability: 0.58,
    contributing_factors: [
      { factor: "GH01 multi-entity discount cluster", weight: 0.42 },
      { factor: "3 critical unresolved alerts", weight: 0.35 },
      { factor: "Payment anomaly pattern (GH03)", weight: 0.2 },
    ],
  },
  "CUST-1021": {
    customer_id: "CUST-1021", customer_name: "Jet Commerce",
    risk_score: 55, conformance_deviation_score: 0.41, churn_probability: 0.28,
    contributing_factors: [
      { factor: "R07 missed billing cycle detected", weight: 0.38 },
      { factor: "Refund rate above threshold (R04)", weight: 0.25 },
    ],
  },
  "CUST-1022": {
    customer_id: "CUST-1022", customer_name: "Kiran Networks",
    risk_score: 33, conformance_deviation_score: 0.22, churn_probability: 0.09,
    contributing_factors: [
      { factor: "R10 chargeback pattern emerging", weight: 0.3 },
      { factor: "Overdue invoice >30 days (R01)", weight: 0.18 },
    ],
  },
  "CUST-1023": {
    customer_id: "CUST-1023", customer_name: "Lotus Healthcare",
    risk_score: 74, conformance_deviation_score: 0.59, churn_probability: 0.44,
    contributing_factors: [
      { factor: "GF08 revenue continuity breached", weight: 0.32 },
      { factor: "Silent churn signal 2 months", weight: 0.28 },
      { factor: "No renewal outreach logged", weight: 0.24 },
    ],
  },
  "CUST-1024": {
    customer_id: "CUST-1024", customer_name: "Metro Print",
    risk_score: 47, conformance_deviation_score: 0.33, churn_probability: 0.18,
    contributing_factors: [
      { factor: "Contract-less discount on 2 invoices", weight: 0.4 },
      { factor: "GF06 gate not enforced", weight: 0.3 },
    ],
  },
  "CUST-1025": {
    customer_id: "CUST-1025", customer_name: "Nova Constructions",
    risk_score: 68, conformance_deviation_score: 0.52, churn_probability: 0.37,
    contributing_factors: [
      { factor: "Over-discount on 4 consecutive invoices", weight: 0.45 },
      { factor: "GF02 approval gate violated repeatedly", weight: 0.3 },
      { factor: "Approver AP-09 pattern (GH01)", weight: 0.18 },
    ],
  },
  "CUST-1026": {
    customer_id: "CUST-1026", customer_name: "Omega Fintech",
    risk_score: 88, conformance_deviation_score: 0.71, churn_probability: 0.62,
    contributing_factors: [
      { factor: "Duplicate payments on 3 invoices", weight: 0.48 },
      { factor: "GF05 idempotency guard bypassed", weight: 0.32 },
      { factor: "High churn signal from usage ML model", weight: 0.15 },
    ],
  },
  "CUST-1010": {
    customer_id: "CUST-1010", customer_name: "Maple SaaS",
    risk_score: 71, conformance_deviation_score: 0.53, churn_probability: 0.39,
    contributing_factors: [
      { factor: "R11 contract reference missing on 2 orders", weight: 0.4 },
      { factor: "Discount cluster risk pattern (GH01)", weight: 0.25 },
      { factor: "Acknowledged alert aged >7 days", weight: 0.18 },
    ],
  },
};

// ── Customer Explain (same 12) ────────────────────────────────
const customersExplain = {
  "CUST-0042": {
    customer_id: "CUST-0042",
    conformance_deviations: [{
      rule_id: "GF02", process_break_step: "DISCOUNT_APPLIED",
      expected_next: "DISCOUNT_APPROVED", actual_next: "INVOICE_ISSUED",
      deviation_type: "MISSING_APPROVAL", leak_amount_rs: 420000,
      evidence: "Discount 68% applied on 2025-03-12 without approval record. Invoice INV-1004 issued same day.",
    }],
    graph_links: { heuristic: "GH01", connected_entities: ["INV-1004","INV-1007","INV-1009","Approver: AP-03"] },
    counterfactual: {
      cf_id: "CF02", statement: "If discount normalized from 68% to 12% → invoice amount increases by ₹3.8L.",
      estimated_recovery_rs: 380000, confidence: 0.75,
    },
    rule_traces: ["R03","GH01"],
  },
  "CUST-0108": {
    customer_id: "CUST-0108",
    conformance_deviations: [{
      rule_id: "GF05", process_break_step: "PAYMENT_SUCCEEDED",
      expected_next: null, actual_next: "PAYMENT_SUCCEEDED (duplicate)",
      deviation_type: "DUPLICATE_SETTLEMENT", leak_amount_rs: 120000,
      evidence: "Two success-status payments recorded against INV-2203, same amount, 2 days apart.",
    }],
    graph_links: { heuristic: "GH03", connected_entities: ["INV-2203","PAY-5541","PAY-5560"] },
    counterfactual: {
      cf_id: "CF05", statement: "If duplicate-payment guard active at processor → ₹1.2L immediately recoverable.",
      estimated_recovery_rs: 120000, confidence: 0.95,
    },
    rule_traces: ["R02","GH03"],
  },
  "CUST-0077": {
    customer_id: "CUST-0077",
    conformance_deviations: [{
      rule_id: "GF08", process_break_step: "USAGE_DECLINE_FLAGGED",
      expected_next: "CHURN_RISK_FLAG", actual_next: "RENEWAL_MISSED",
      deviation_type: "NO_RETENTION_TRIGGER", leak_amount_rs: 210000,
      evidence: "Revenue declined >20% for 3 consecutive months (May-Jul 2026); no churn-risk flag raised before renewal miss.",
    }],
    graph_links: { heuristic: "GH05", connected_entities: ["REN-0912","INV-3381","INV-3402"] },
    counterfactual: {
      cf_id: "CF08", statement: "If retention outreach triggered after 2nd consecutive decline month → churn probability drops below threshold.",
      estimated_recovery_rs: 52500, confidence: 0.4,
    },
    rule_traces: ["R09","GH05"],
  },
  "CUST-0031": {
    customer_id: "CUST-0031",
    conformance_deviations: [{
      rule_id: "GF06", process_break_step: "DISCOUNT_APPLIED",
      expected_next: "CONTRACT_REF_ATTACHED", actual_next: "INVOICE_ISSUED",
      deviation_type: "MISSING_CONTRACT_REF", leak_amount_rs: 45000,
      evidence: "Enterprise-segment discount of 24% applied on INV-4410 with no contract_ref on file.",
    }],
    graph_links: { heuristic: "GH01", connected_entities: ["INV-4410","Approver: AP-07"] },
    counterfactual: {
      cf_id: "CF06", statement: "If enterprise discount gate enforced CONTRACT_REF before invoice issue → leak blocked at source.",
      estimated_recovery_rs: 31500, confidence: 0.7,
    },
    rule_traces: ["R11"],
  },
  "CUST-1020": {
    customer_id: "CUST-1020",
    conformance_deviations: [{
      rule_id: "GH01", process_break_step: "DISCOUNT_APPLIED",
      expected_next: "DISCOUNT_APPROVED", actual_next: "INVOICE_ISSUED",
      deviation_type: "CLUSTER_DISCOUNT_ANOMALY", leak_amount_rs: 280000,
      evidence: "Approver AP-11 applied 55% discount across 3 linked entities (INV-5501, INV-5502, INV-5503) without approval trail.",
    }],
    graph_links: { heuristic: "GH01", connected_entities: ["INV-5501","INV-5502","INV-5503","Approver: AP-11","CUST-1025"] },
    counterfactual: {
      cf_id: "CF11", statement: "If multi-entity discount cluster flag triggered at AP-11 → approval required before any invoice issue, blocking ₹2.8L leak.",
      estimated_recovery_rs: 210000, confidence: 0.82,
    },
    rule_traces: ["GH01","GF02","R03"],
  },
  "CUST-1021": {
    customer_id: "CUST-1021",
    conformance_deviations: [{
      rule_id: "R07", process_break_step: "INVOICE_DUE",
      expected_next: "INVOICE_ISSUED", actual_next: "BILLING_SKIPPED",
      deviation_type: "MISSING_INVOICE", leak_amount_rs: 78000,
      evidence: "Monthly billing cycle skipped for August 2026. No invoice issued against REN-1204 renewal.",
    }],
    graph_links: { heuristic: "GH02", connected_entities: ["REN-1204","INV-6601","ORD-3301"] },
    counterfactual: {
      cf_id: "CF12", statement: "If automated billing guard triggers on missed cycle → invoice INV-6601 issued on time, recovering ₹78K.",
      estimated_recovery_rs: 60000, confidence: 0.88,
    },
    rule_traces: ["R07","GH02"],
  },
  "CUST-1023": {
    customer_id: "CUST-1023",
    conformance_deviations: [{
      rule_id: "GF08", process_break_step: "USAGE_DECLINE_FLAGGED",
      expected_next: "CHURN_RISK_FLAG", actual_next: "RENEWAL_MISSED",
      deviation_type: "NO_RETENTION_TRIGGER", leak_amount_rs: 160000,
      evidence: "Lotus Healthcare usage dropped 28% in Jun-Aug 2026, GF08 continuity check not triggered, renewal lapsed.",
    }],
    graph_links: { heuristic: "GH05", connected_entities: ["REN-1890","INV-7701","INV-7702","INV-7703"] },
    counterfactual: {
      cf_id: "CF13", statement: "If GF08 continuity guard activated on 2nd decline month → churn outreach issued, renewal likely saved.",
      estimated_recovery_rs: 96000, confidence: 0.55,
    },
    rule_traces: ["R09","GF08","GH05"],
  },
  "CUST-1024": {
    customer_id: "CUST-1024",
    conformance_deviations: [{
      rule_id: "GF06", process_break_step: "DISCOUNT_APPLIED",
      expected_next: "CONTRACT_REF_ATTACHED", actual_next: "INVOICE_ISSUED",
      deviation_type: "MISSING_CONTRACT_REF", leak_amount_rs: 42000,
      evidence: "Enterprise discount applied on INV-8801 and INV-8802 without CONTRACT_REF on file.",
    }],
    graph_links: { heuristic: "GH01", connected_entities: ["INV-8801","INV-8802","Approver: AP-04"] },
    counterfactual: {
      cf_id: "CF14", statement: "If GF06 gate enforced → contract ref required before invoice issue, blocking ₹42K leak.",
      estimated_recovery_rs: 31000, confidence: 0.72,
    },
    rule_traces: ["R11","GF06"],
  },
  "CUST-1025": {
    customer_id: "CUST-1025",
    conformance_deviations: [{
      rule_id: "GF02", process_break_step: "DISCOUNT_APPLIED",
      expected_next: "DISCOUNT_APPROVED", actual_next: "INVOICE_ISSUED",
      deviation_type: "MISSING_APPROVAL", leak_amount_rs: 230000,
      evidence: "Discount of 52% applied across 4 consecutive invoices (INV-9901–9904) without manager approval.",
    }],
    graph_links: { heuristic: "GH01", connected_entities: ["INV-9901","INV-9902","INV-9903","INV-9904","Approver: AP-09"] },
    counterfactual: {
      cf_id: "CF15", statement: "If discount approval gate active → approvals required for >30% discounts, recovering ₹2.3L over 4 invoices.",
      estimated_recovery_rs: 165000, confidence: 0.79,
    },
    rule_traces: ["GF02","R03","GH01"],
  },
  "CUST-1026": {
    customer_id: "CUST-1026",
    conformance_deviations: [
      {
        rule_id: "GF05", process_break_step: "PAYMENT_SUCCEEDED",
        expected_next: null, actual_next: "PAYMENT_SUCCEEDED (duplicate)",
        deviation_type: "DUPLICATE_SETTLEMENT", leak_amount_rs: 95000,
        evidence: "Duplicate payment on INV-AA01: PAY-7761 and PAY-7762 both succeeded within 48 hours.",
      },
      {
        rule_id: "GF05", process_break_step: "PAYMENT_SUCCEEDED",
        expected_next: null, actual_next: "PAYMENT_SUCCEEDED (duplicate)",
        deviation_type: "DUPLICATE_SETTLEMENT", leak_amount_rs: 85000,
        evidence: "Second duplicate pattern on INV-AA03: PAY-7780 and PAY-7781 both settled.",
      },
    ],
    graph_links: { heuristic: "GH03", connected_entities: ["INV-AA01","INV-AA03","PAY-7761","PAY-7762","PAY-7780","PAY-7781"] },
    counterfactual: {
      cf_id: "CF16", statement: "If idempotency guard active at payment processor → both duplicates blocked, ₹1.8L fully recoverable.",
      estimated_recovery_rs: 180000, confidence: 0.97,
    },
    rule_traces: ["GF05","R02","GH03"],
  },
  "CUST-1010": {
    customer_id: "CUST-1010",
    conformance_deviations: [{
      rule_id: "R11", process_break_step: "DISCOUNT_APPLIED",
      expected_next: "CONTRACT_REF_ATTACHED", actual_next: "INVOICE_ISSUED",
      deviation_type: "MISSING_CONTRACT_REF", leak_amount_rs: 310000,
      evidence: "Maple SaaS enterprise tier discount of 38% applied on INV-BB01 and INV-BB02 without contract reference.",
    }],
    graph_links: { heuristic: "GH01", connected_entities: ["INV-BB01","INV-BB02","Approver: AP-05"] },
    counterfactual: {
      cf_id: "CF17", statement: "If R11 policy enforced at invoice issue → contract_ref required for >30% discounts, blocking ₹3.1L.",
      estimated_recovery_rs: 217000, confidence: 0.68,
    },
    rule_traces: ["R11","GF06"],
  },
  "CUST-1022": {
    customer_id: "CUST-1022",
    conformance_deviations: [{
      rule_id: "R10", process_break_step: "CHARGEBACK_RECEIVED",
      expected_next: "FRAUD_REVIEW_TRIGGERED", actual_next: "CHARGEBACK_ACCEPTED",
      deviation_type: "MISSING_FRAUD_REVIEW", leak_amount_rs: 32000,
      evidence: "3rd chargeback from Kiran Networks in 90 days; fraud review not triggered despite R10 threshold.",
    }],
    graph_links: { heuristic: "GH04", connected_entities: ["CB-1101","CB-1102","CB-1103","INV-CC01"] },
    counterfactual: {
      cf_id: "CF18", statement: "If R10 chargeback pattern flag triggers fraud review after 2nd chargeback → 3rd prevented, ₹32K recovered.",
      estimated_recovery_rs: 22000, confidence: 0.61,
    },
    rule_traces: ["R10","GH04"],
  },
};

// ── Chat canned responses ─────────────────────────────────────
const chatResponses = [
  {
    query: "Why is Acme Corp losing revenue?",
    response: {
      answer: "Acme Corp applied a 68% discount without approval on 3 invoices, breaking the discount-approval gate. Estimated leak: ₹4.2L. Normalizing the discount to the 12% plan median recovers approximately ₹3.8L.",
      leak_amount_rs: 420000, process_break: "DISCOUNT_APPLIED without DISCOUNT_APPROVED",
      connected_entities: ["INV-1004","INV-1007","INV-1009"],
      recommended_action: "Normalize discount to plan median (12%)", recovery_estimate_rs: 380000,
    },
  },
  {
    query: "What happened with Vertex Ltd?",
    response: {
      answer: "Vertex Ltd was billed twice for invoice INV-2203 — two successful payments were recorded 2 days apart for the same amount. This is a deterministic duplicate-payment leak of ₹1.2L, fully recoverable by reversing the second charge.",
      leak_amount_rs: 120000, process_break: "Duplicate PAYMENT_SUCCEEDED on INV-2203",
      connected_entities: ["INV-2203","PAY-5541","PAY-5560"],
      recommended_action: "Reverse duplicate payment PAY-5560", recovery_estimate_rs: 120000,
    },
  },
  {
    query: "Is Neon Retail at risk of churning?",
    response: {
      answer: "Yes. Neon Retail's revenue declined more than 20% for 3 consecutive months and no churn-risk flag was raised before their renewal was missed, breaking the revenue-continuity flow. Estimated LTV at risk: ₹2.1L. Triggering retention outreach after the 2nd decline month could have reduced churn probability.",
      leak_amount_rs: 210000, process_break: "USAGE_DECLINE_FLAGGED without CHURN_RISK_FLAG",
      connected_entities: ["REN-0912","INV-3381","INV-3402"],
      recommended_action: "Trigger retention outreach immediately", recovery_estimate_rs: 52500,
    },
  },
  {
    query: "What is happening with Indus Pharma?",
    response: {
      answer: "Indus Pharma has the highest risk score in the portfolio at 91. Approver AP-11 applied a 55% discount across 3 linked entities without any approval trail, triggering GH01 multi-entity cluster heuristic. Total leak is ₹2.8L with ₹2.1L recoverable if normalized.",
      leak_amount_rs: 280000, process_break: "DISCOUNT_APPLIED across entity cluster without DISCOUNT_APPROVED",
      connected_entities: ["INV-5501","INV-5502","INV-5503","Approver: AP-11"],
      recommended_action: "Trigger multi-entity discount review for Approver AP-11", recovery_estimate_rs: 210000,
    },
  },
  {
    query: "Which customers have duplicate payments?",
    response: {
      answer: "Three customers have confirmed duplicate-payment leaks: Vertex Ltd (₹1.2L on INV-2203), Omega Fintech (₹1.8L across two invoices), and several others with smaller amounts. Total duplicate payment exposure is the single largest recoverable category at near-100% recovery rate — these are deterministic reversals, not estimates.",
      leak_amount_rs: 316000, process_break: "Multiple PAYMENT_SUCCEEDED duplicate settlements",
      connected_entities: ["INV-2203","PAY-5541","INV-AA01","PAY-7761","INV-AA03","PAY-7780"],
      recommended_action: "Enable idempotency guard at payment processor for all customer accounts", recovery_estimate_rs: 300000,
    },
  },
  {
    query: "Show me the biggest recovery opportunity",
    response: {
      answer: "The largest single recovery opportunity is Acme Corp's over-discount leak at ₹4.2L, recoverable at ₹3.8L (75% confidence). Followed by Indus Pharma's cluster discount anomaly at ₹2.8L (82% confidence). Together these two alone represent over ₹6L in recoverable revenue pending one approval action each.",
      leak_amount_rs: 700000, process_break: "Approval gates bypassed across two high-value accounts",
      connected_entities: ["CUST-0042","CUST-1020","INV-1004","INV-5501"],
      recommended_action: "Prioritize Approve Action on Acme Corp and Indus Pharma first", recovery_estimate_rs: 590000,
    },
  },
];

// ── Audit log (14 entries) ────────────────────────────────────
const auditLog = [
  { log_id: 975, alert_id: "ALT-00002", action_type: "mark_re_invoiced", actor: "user", outcome: "success", executed_at: "2026-08-19T10:00:00Z" },
  { log_id: 976, alert_id: "ALT-00003", action_type: "acknowledge", actor: "user", outcome: "success", executed_at: "2026-08-15T15:00:00Z" },
  { log_id: 977, alert_id: "ALT-00001", action_type: "normalize_discount", actor: "user", outcome: "success", executed_at: "2026-08-20T11:30:00Z" },
  { log_id: 978, alert_id: "ALT-00010", action_type: "acknowledge", actor: "system", outcome: "success", executed_at: "2026-08-17T12:00:00Z" },
  { log_id: 979, alert_id: "ALT-00009", action_type: "escalate_fraud", actor: "user", outcome: "success", executed_at: "2026-08-18T14:20:00Z" },
  { log_id: 980, alert_id: "ALT-00007", action_type: "trigger_outreach", actor: "agent", outcome: "success", executed_at: "2026-08-20T09:00:00Z" },
  { log_id: 981, alert_id: "ALT-00016", action_type: "mark_re_invoiced", actor: "user", outcome: "success", executed_at: "2026-08-11T13:45:00Z" },
  { log_id: 982, alert_id: "ALT-00017", action_type: "attach_contract_ref", actor: "user", outcome: "success", executed_at: "2026-08-10T16:00:00Z" },
  { log_id: 983, alert_id: "ALT-00015", action_type: "reverse_payment", actor: "system", outcome: "success", executed_at: "2026-08-12T11:00:00Z" },
  { log_id: 984, alert_id: "ALT-00013", action_type: "reverse_payment", actor: "user", outcome: "failed", executed_at: "2026-08-14T10:30:00Z" },
  { log_id: 985, alert_id: "ALT-00013", action_type: "reverse_payment", actor: "user", outcome: "success", executed_at: "2026-08-14T10:45:00Z" },
  { log_id: 986, alert_id: "ALT-00006", action_type: "enforce_refund_policy", actor: "agent", outcome: "success", executed_at: "2026-08-21T19:00:00Z" },
  { log_id: 987, alert_id: "ALT-00011", action_type: "escalate_fraud", actor: "user", outcome: "success", executed_at: "2026-08-16T11:30:00Z" },
  { log_id: 988, alert_id: "ALT-00008", action_type: "reissue_invoice", actor: "system", outcome: "success", executed_at: "2026-08-19T12:00:00Z" },
];

// ── Assemble output ───────────────────────────────────────────
const output = {
  "GET /api/alerts": {
    page: 1,
    page_size: 25,
    total: alerts.length,
    alerts: alerts,
  },
  "GET /api/customer/{id}/risk": customersRisk,
  "GET /api/customer/{id}/explain": customersExplain,
  "GET /api/recoverable-summary": {
    total_leakage_rs: totalLeakage,
    total_recoverable_rs: totalRecoverable,
    active_alerts: activeAlerts,
    avg_risk_score: 57,
    by_leak_type: byLeakType,
    by_severity: bySeverity,
    trend_30d: trend60d.slice(-30), // last 30 days for dashboard
    trend_60d: trend60d,
  },
  "POST /api/chat": chatResponses,
  "POST /api/actions/execute": {
    status: "success",
    audit_log_id: 981,
    executed_at: "2026-08-27T14:32:00Z",
  },
  "GET /api/health": {
    status: "ok",
    db: "connected",
    model_loaded: true,
    narrator_mode: "mock",
  },
  audit_log_sample: auditLog,
};

const outPath = resolve(__dirname, "../src/mocks/mock_api.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`✅ Generated mock_api.json with ${alerts.length} alerts, ${Object.keys(customersRisk).length} customers`);
console.log(`   Total leakage: ₹${totalLeakage.toLocaleString("en-IN")}`);
console.log(`   Total recoverable: ₹${totalRecoverable.toLocaleString("en-IN")}`);
console.log(`   Active alerts: ${activeAlerts}`);
