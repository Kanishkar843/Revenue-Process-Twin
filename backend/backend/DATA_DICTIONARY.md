# Revenue Process Twin — Data Dictionary

Authoritative database specification for `revenue_leaks.db`.

---

## 1. `customers`
Stores baseline customer master data.

| Column | Type | Nullable | Description & Allowed Values | Units / Format |
|---|---|---|---|---|
| `customer_id` | `TEXT` | PRIMARY KEY | Unique customer identifier (e.g. `CUST-0042`) | String |
| `name` | `TEXT` | NOT NULL | Company / Customer Name (e.g. `Acme Corp`) | String |
| `segment` | `TEXT` | NOT NULL | Business classification (`enterprise`, `smb`) | String |
| `plan` | `TEXT` | NOT NULL | Subscription tier (`Starter`, `Professional`, `Enterprise`) | String |
| `plan_mrr_paise` | `INTEGER` | NOT NULL | Monthly Recurring Revenue in paise | Paise (1 INR = 100 paise) |
| `created_at` | `TEXT` | NOT NULL | Account creation date | ISO-8601 (`YYYY-MM-DD`) |
| `region` | `TEXT` | NOT NULL | Geographical region (`North`, `South`, `East`, `West`, `Central`) | String |

---

## 2. `invoices`
Stores billing invoices issued to customers.

| Column | Type | Nullable | Description & Allowed Values | Units / Format |
|---|---|---|---|---|
| `invoice_id` | `TEXT` | PRIMARY KEY | Unique invoice ID (e.g. `INV-10042`) | String |
| `customer_id` | `TEXT` | FOREIGN KEY | Reference to `customers.customer_id` | String |
| `issue_date` | `TEXT` | NOT NULL | Invoice issue date | ISO-8601 (`YYYY-MM-DD`) |
| `due_date` | `TEXT` | NOT NULL | Invoice payment due date | ISO-8601 (`YYYY-MM-DD`) |
| `amount_paise` | `INTEGER` | NOT NULL | Total gross invoice amount | Paise (INTEGER) |
| `discount_pct` | `REAL` | NOT NULL | Applied discount rate (e.g., `0.68` for 68%) | Float (`0.0` to `1.0`) |
| `status` | `TEXT` | NOT NULL | Status (`issued`, `paid`, `overdue`, `void`, `disputed`, `partially_paid`) | String |
| `contract_ref` | `TEXT` | NULLABLE | Associated contract reference ID (e.g. `CTR-0042`) | String / NULL |

---

## 3. `payments`
Stores payment settlement attempts and records.

| Column | Type | Nullable | Description & Allowed Values | Units / Format |
|---|---|---|---|---|
| `payment_id` | `TEXT` | PRIMARY KEY | Unique payment attempt identifier | String |
| `invoice_id` | `TEXT` | FOREIGN KEY | Reference to `invoices.invoice_id` | String |
| `customer_id` | `TEXT` | FOREIGN KEY | Reference to `customers.customer_id` | String |
| `amount_paise` | `INTEGER` | NOT NULL | Payment amount processed in paise | Paise (INTEGER) |
| `method` | `TEXT` | NOT NULL | Payment method (`upi`, `card`, `netbanking`, `wire`) | String |
| `status` | `TEXT` | NOT NULL | Outcome (`success`, `failed`, `refunded`, `duplicate`, `chargeback`) | String |
| `payment_ts` | `TEXT` | NULLABLE | Exact timestamp of payment processing | ISO-8601 timestamp |
| `attempt_no` | `INTEGER` | NOT NULL | Sequential retry attempt number (default `1`) | Integer |

---

## 4. `transactions`
Stores financial ledger movements (purchases, refunds, chargebacks).

| Column | Type | Nullable | Description & Allowed Values | Units / Format |
|---|---|---|---|---|
| `txn_id` | `TEXT` | PRIMARY KEY | Unique transaction record ID | String |
| `customer_id` | `TEXT` | FOREIGN KEY | Reference to `customers.customer_id` | String |
| `amount_paise` | `INTEGER` | NOT NULL | Transaction value in paise | Paise (INTEGER) |
| `type` | `TEXT` | NOT NULL | Transaction type (`purchase`, `refund`, `chargeback`, `adjustment`) | String |
| `txn_ts` | `TEXT` | NOT NULL | Transaction timestamp | ISO-8601 (`YYYY-MM-DD`) |

---

## 5. `renewals`
Stores subscription renewal lifecycle states.

| Column | Type | Nullable | Description & Allowed Values | Units / Format |
|---|---|---|---|---|
| `renewal_id` | `TEXT` | PRIMARY KEY | Unique renewal record ID | String |
| `customer_id` | `TEXT` | FOREIGN KEY | Reference to `customers.customer_id` | String |
| `due_date` | `TEXT` | NOT NULL | Renewal due date | ISO-8601 (`YYYY-MM-DD`) |
| `status` | `TEXT` | NOT NULL | Status (`renewed`, `missed`, `failed_payment`, `pending`) | String |
| `attempt_count` | `INTEGER` | NOT NULL | Number of retry attempts made | Integer |
| `last_attempt_ts` | `TEXT` | NULLABLE | Last retry timestamp | ISO-8601 timestamp |

---

## 6. `event_log`
Append-only lifecycle event trail per entity.

| Column | Type | Nullable | Description & Allowed Values | Units / Format |
|---|---|---|---|---|
| `event_id` | `TEXT` | PRIMARY KEY | Unique event log entry ID | String |
| `entity_id` | `TEXT` | NOT NULL | ID of entity (`customer_id`, `invoice_id`, `renewal_id`) | String |
| `entity_type` | `TEXT` | NOT NULL | Entity classification (`customer`, `invoice`, `renewal`, `payment`) | String |
| `event_type` | `TEXT` | NOT NULL | Event classification (`CONTRACT_APPROVED`, `INVOICE_ISSUED`, `DISCOUNT_APPLIED`, `DISCOUNT_APPROVED`, `PAYMENT_ATTEMPTED`, `PAYMENT_SUCCEEDED`, `PAYMENT_FAILED`, `RENEWAL_DUE`, `RENEWAL_SUCCEEDED`, `RENEWAL_MISSED`, `REFUND_ISSUED`, `CHARGEBACK_RAISED`, `USAGE_DECLINE_FLAGGED`) | String |
| `event_ts` | `TEXT` | NOT NULL | Event occurrence timestamp | ISO-8601 timestamp |
| `metadata_json` | `TEXT` | NULLABLE | Structured JSON metadata | Valid JSON string |
| `created_at` | `TEXT` | NOT NULL | Log record creation timestamp | ISO-8601 timestamp |

---

## 7. `alerts`
Stores flagged revenue leakage detection alerts.

| Column | Type | Nullable | Description & Allowed Values | Units / Format |
|---|---|---|---|---|
| `alert_id` | `TEXT` | PRIMARY KEY | Unique alert ID (e.g. `ALT-00042`) | String |
| `customer_id` | `TEXT` | FOREIGN KEY | Reference to `customers.customer_id` | String |
| `rule_id` | `TEXT` | NOT NULL | Detection rule or flow ID (`R01`-`R11`, `GF01`-`GF08`, `GH01`-`GH05`) | String |
| `leak_type` | `TEXT` | NOT NULL | Classification (`over_discount`, `duplicate_payment`, `silent_churn`, `overdue_invoice`, etc.) | String |
| `severity` | `TEXT` | NOT NULL | Severity level (`critical`, `high`, `medium`, `low`) | String |
| `leak_amount_paise` | `INTEGER` | NOT NULL | Total financial leakage in paise | Paise (INTEGER) |
| `recoverable_paise` | `INTEGER` | NOT NULL | Recoverable financial leakage in paise | Paise (INTEGER) |
| `process_break_step` | `TEXT` | NULLABLE | Event step where lifecycle broke | String |
| `expected_next` | `TEXT` | NULLABLE | Expected next event step | String |
| `actual_next` | `TEXT` | NULLABLE | Actual observed next event step | String |
| `connected_entities_json` | `TEXT` | NULLABLE | JSON list of related entity IDs | JSON array |
| `recommended_action` | `TEXT` | NULLABLE | Recommended counterfactual intervention | String |
| `action_confidence` | `REAL` | NULLABLE | Counterfactual recovery probability (`0.0` - `1.0`) | Float |
| `evidence_json` | `TEXT` | NOT NULL | Machine-readable evidence payload | JSON object |
| `status` | `TEXT` | NOT NULL | Alert status (`open`, `acknowledged`, `resolved`) | String |
| `created_at` | `TEXT` | NOT NULL | Alert generation timestamp | ISO-8601 timestamp |

---

## 8. `audit_log`
Append-only audit trail of user and system counterfactual actions.

| Column | Type | Nullable | Description & Allowed Values | Units / Format |
|---|---|---|---|---|
| `log_id` | `INTEGER` | PRIMARY KEY AUTOINCREMENT | Unique log entry sequence | Auto-increment integer |
| `alert_id` | `TEXT` | NULLABLE | Reference to target `alerts.alert_id` | String / NULL |
| `action_type` | `TEXT` | NOT NULL | Executed action type (`mark_re_invoiced`, `normalize_discount`, etc.) | String |
| `actor` | `TEXT` | NOT NULL | Execution actor (`user`, `system`, `agent`) | String |
| `payload_json` | `TEXT` | NOT NULL | Full action request payload JSON | JSON string |
| `executed_at` | `TEXT` | NOT NULL | Action execution timestamp | ISO-8601 timestamp |
| `outcome` | `TEXT` | NULLABLE | Execution outcome (`SUCCESS`, `FAILED`) | String |
