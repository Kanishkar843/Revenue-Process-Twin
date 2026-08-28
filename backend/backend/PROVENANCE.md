# Revenue Process Twin — Dataset Provenance & Transformations

This document records the lineage of raw source datasets, target tables, and transformations applied to build `revenue_leaks.db`.

---

## 1. Dataset Lineage & Mapping

| Source Dataset | Origin / Provider | Target Tables | Applied Transformation |
|---|---|---|---|
| **D1: Online Retail II** (`online_retail_ii.csv`) | UCI Machine Learning Repository | `customers`, `invoices`, `payments`, `transactions` | Converted GBP → INR → Paise (`1 GBP = 105 INR = 10,500 paise`). Mapped `InvoiceNo` starting with 'C' to cancellation/refund transactions. Generated payment attempts. |
| **D3: Telco Customer Churn** (`telco_churn.csv`) | IBM / Kaggle | Trained XGBoost Model (`ml/models/churn_xgb.pkl`) | **Train Only**. Never loaded into production tables directly. Learned feature relationships (`days_since_last_purchase`, `revenue_decline_streak`, `failed_payment_count`, `refund_ratio`, `renewal_miss_count`, `plan_mrr`) to score customer `churn_probability`. |
| **D4: SaaS Subscription** (`saas.csv` / RavenStack) | Kaggle / Synthetic SaaS | `customers`, `renewals` | Provided subscription plan structure (`Starter`, `Professional`, `Enterprise`), renewal cadence, and baseline MRR mapping. |
| **D6: Finance Factoring** (`late_payment.csv`) | IBM Factoring / Kaggle | Distribution Sampling for `invoices` & `payments` | **No Row Copying**. Sampled lateness gap distribution (`due_date` → `paid_at` delta: 70% prompt, 20% 1-30d late, 10% >30d late) when populating overdue invoices. |
| **D7: MSME Invoices & Transactions** (`msme.csv`) | MSME Invoices / Kaggle | `customers` | Extracted Indian company names, regional distribution (`North`, `South`, `East`, `West`, `Central`), and industry business context for customer master rows. |

---

## 2. Key Data Transformations & Rules
1. **Integer Paise Financial Precision**:
   - All currency values stored in SQLite are strictly `INTEGER` paise end-to-end (`amount_paise`, `plan_mrr_paise`, `leak_amount_paise`, `recoverable_paise`).
   - Replaced floating-point currency representation to guarantee zero rounding error in ledger math.
2. **Deterministic Seed Leaks Injection**:
   - `CUST-0042` (Acme Corp): Hard-coded 11 invoices with 55%-68% discounts vs 12% plan median without approval record (`GF02 + R03 + GH01`, Critical).
   - `CUST-0108` (Vertex Ltd): Duplicate payment injection on `INV-20108` (`GF05 + R02 + GH03`, High).
   - `CUST-0077` (Neon Retail): 3 consecutive months >20%/mo revenue decline + missed renewal (`GF08 + R09 + GH05`, High).
   - `CUST-0031` (BlueStar): Enterprise discount 25% (>20%) applied without `contract_ref` (`GF06 + R11`, Medium).
3. **Event Log Sequential Normalization**:
   - Emitted canonical sequence events (`CONTRACT_APPROVED`, `INVOICE_ISSUED`, `DISCOUNT_APPLIED`, `DISCOUNT_APPROVED`, `PAYMENT_ATTEMPTED`, `PAYMENT_SUCCEEDED`, `PAYMENT_FAILED`, `RENEWAL_DUE`, `RENEWAL_SUCCEEDED`, `RENEWAL_MISSED`, `REFUND_ISSUED`, `CHARGEBACK_RAISED`, `USAGE_DECLINE_FLAGGED`) per entity with ISO-8601 timestamps.
