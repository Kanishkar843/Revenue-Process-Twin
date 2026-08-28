-- Authoritative Schema for Revenue Process Twin SQLite Database
DROP TABLE IF EXISTS business_profiles;

DROP TABLE IF EXISTS audit_log;

DROP TABLE IF EXISTS alerts;

DROP TABLE IF EXISTS event_log;

DROP TABLE IF EXISTS renewals;

DROP TABLE IF EXISTS transactions;

DROP TABLE IF EXISTS payments;

DROP TABLE IF EXISTS invoices;

DROP TABLE IF EXISTS customers;

CREATE TABLE business_profiles (
    user_id TEXT PRIMARY KEY,
    email TEXT,
    company_name TEXT,
    business_type TEXT,
    company_size TEXT,
    revenue_model TEXT,
    currency TEXT DEFAULT 'INR',
    created_at TEXT DEFAULT(datetime('now'))
);

CREATE TABLE customers (
    customer_id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'system',
    name TEXT NOT NULL,
    segment TEXT NOT NULL, -- e.g. enterprise, smb
    plan TEXT NOT NULL,
    plan_mrr_paise INTEGER NOT NULL,
    created_at TEXT NOT NULL, -- ISO-8601
    region TEXT NOT NULL
);

CREATE TABLE invoices (
    invoice_id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'system',
    customer_id TEXT NOT NULL REFERENCES customers (customer_id),
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    discount_pct REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL, -- issued|paid|overdue|void|disputed|partially_paid
    contract_ref TEXT
);

CREATE TABLE payments (
    payment_id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'system',
    invoice_id TEXT NOT NULL REFERENCES invoices (invoice_id),
    customer_id TEXT NOT NULL REFERENCES customers (customer_id),
    amount_paise INTEGER NOT NULL,
    method TEXT NOT NULL, -- upi|card|netbanking|wire
    status TEXT NOT NULL, -- success|failed|refunded|duplicate|chargeback
    payment_ts TEXT,
    attempt_no INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE transactions (
    txn_id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'system',
    customer_id TEXT NOT NULL REFERENCES customers (customer_id),
    amount_paise INTEGER NOT NULL,
    type TEXT NOT NULL, -- purchase|refund|chargeback|adjustment
    txn_ts TEXT NOT NULL
);

CREATE TABLE renewals (
    renewal_id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'system',
    customer_id TEXT NOT NULL REFERENCES customers (customer_id),
    due_date TEXT NOT NULL,
    status TEXT NOT NULL, -- renewed|missed|failed_payment|pending
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_ts TEXT
);

CREATE TABLE event_log (
    event_id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'system',
    entity_id TEXT NOT NULL, -- customer_id / invoice_id / renewal_id
    entity_type TEXT NOT NULL, -- customer|invoice|renewal|payment
    event_type TEXT NOT NULL,
    event_ts TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE alerts (
    alert_id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'system',
    customer_id TEXT NOT NULL REFERENCES customers (customer_id),
    rule_id TEXT NOT NULL, -- R01-R11 | GF01-GF08 | GH01-GH05
    leak_type TEXT NOT NULL,
    severity TEXT NOT NULL, -- critical|high|medium|low
    leak_amount_paise INTEGER NOT NULL,
    recoverable_paise INTEGER NOT NULL,
    process_break_step TEXT,
    expected_next TEXT,
    actual_next TEXT,
    connected_entities_json TEXT,
    recommended_action TEXT,
    action_confidence REAL,
    evidence_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- open|acknowledged|resolved
    created_at TEXT NOT NULL
);

CREATE TABLE audit_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'system',
    alert_id TEXT,
    action_type TEXT NOT NULL,
    actor TEXT NOT NULL, -- user|system|agent
    payload_json TEXT NOT NULL,
    executed_at TEXT NOT NULL,
    outcome TEXT
);

-- Indexes
CREATE INDEX idx_customers_user_id ON customers (user_id);

CREATE INDEX idx_invoices_user_id ON invoices (user_id);

CREATE INDEX idx_invoices_customer ON invoices (customer_id);

CREATE INDEX idx_invoices_status ON invoices (status);

CREATE INDEX idx_invoices_due_date ON invoices (due_date);

CREATE INDEX idx_payments_user_id ON payments (user_id);

CREATE INDEX idx_payments_invoice ON payments (invoice_id);

CREATE INDEX idx_payments_status ON payments (status);

CREATE INDEX idx_transactions_user_id ON transactions (user_id);

CREATE INDEX idx_transactions_customer_date ON transactions (customer_id, txn_ts);

CREATE INDEX idx_transactions_type ON transactions(type);

CREATE INDEX idx_renewals_user_id ON renewals (user_id);

CREATE INDEX idx_renewals_customer ON renewals (customer_id);

CREATE INDEX idx_renewals_status ON renewals (status);

CREATE INDEX idx_alerts_user_id ON alerts (user_id);

CREATE INDEX idx_alerts_customer ON alerts (customer_id);

CREATE INDEX idx_alerts_severity ON alerts (severity);

CREATE INDEX idx_alerts_status ON alerts (status);

CREATE INDEX idx_event_log_user_id ON event_log (user_id);

CREATE INDEX idx_event_log_entity ON event_log (entity_id, event_ts);

CREATE INDEX idx_audit_log_user_id ON audit_log (user_id);