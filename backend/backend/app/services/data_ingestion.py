import os
import io
import json
import zipfile
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sqlite3
from app.db.connection import get_connection, get_db_path
from app.services.event_log_builder import build_event_log

def parse_and_ingest_file(file_content: bytes, filename: str, user_id: str = "system") -> dict:
    """
    Ingests user-uploaded files (.csv, .xlsx, .xls, .json, .zip) into the unified SQLite database.
    Flexible column mapping supports standard billing, SaaS, customer, invoice, payment, transaction, and renewal schemas.
    """
    if not file_content:
        raise ValueError("Uploaded file is empty.")

    ext = os.path.splitext(filename)[1].lower()
    dataframes = {}

    if ext in ('.xlsx', '.xls'):
        # Read all sheets from Excel
        excel_file = pd.ExcelFile(io.BytesIO(file_content))
        for sheet_name in excel_file.sheet_names:
            df = pd.read_excel(excel_file, sheet_name=sheet_name)
            if not df.empty:
                dataframes[f"{filename}_{sheet_name}"] = df

    elif ext == '.csv':
        # Try UTF-8-SIG (handles BOM automatically), with fallbacks to UTF-8 and Latin-1
        df = None
        for enc in ['utf-8-sig', 'utf-8', 'latin1']:
            try:
                df = pd.read_csv(io.BytesIO(file_content), encoding=enc, encoding_errors='replace')
                break
            except Exception:
                continue
        if df is not None and not df.empty:
            dataframes[filename] = df

    elif ext == '.json':
        try:
            data = json.loads(file_content.decode('utf-8'))
        except Exception:
            data = json.loads(file_content.decode('latin1'))

        if isinstance(data, list):
            df = pd.DataFrame(data)
            if not df.empty:
                dataframes[filename] = df
        elif isinstance(data, dict):
            if any(isinstance(v, list) for v in data.values()):
                for k, v in data.items():
                    if isinstance(v, list):
                        df_sub = pd.DataFrame(v)
                        if not df_sub.empty:
                            dataframes[f"{filename}_{k}"] = df_sub
            else:
                df = pd.DataFrame([data])
                if not df.empty:
                    dataframes[filename] = df

    elif ext == '.zip':
        total_zip_records = 0
        zip_tables_updated = set()
        with zipfile.ZipFile(io.BytesIO(file_content)) as z:
            for zip_filename in z.namelist():
                zip_ext = os.path.splitext(zip_filename)[1].lower()
                if zip_ext in ('.csv', '.xlsx', '.xls', '.json'):
                    with z.open(zip_filename) as f:
                        content = f.read()
                        if content:
                            try:
                                res = parse_and_ingest_file(content, zip_filename)
                                total_zip_records += res.get("records_processed", 0)
                                zip_tables_updated.update(res.get("tables_updated", []))
                            except ValueError:
                                pass

        if total_zip_records == 0:
            raise ValueError(f"ZIP archive '{filename}' contains no valid or supported data records.")

        return {
            "filename": filename,
            "file_type": ext,
            "records_processed": total_zip_records,
            "tables_updated": list(zip_tables_updated),
            "status": "success",
            "message": f"Successfully ingested {total_zip_records} records from ZIP archive into {', '.join(zip_tables_updated)}."
        }

    else:
        raise ValueError(f"Unsupported file format: {ext}. Accepted formats: .csv, .xlsx, .xls, .json, .zip")

    if not dataframes:
        raise ValueError(f"File '{filename}' was parsed but contained no valid data rows.")

    records_processed = 0
    tables_updated = set()
    db_path = get_db_path()

    with get_connection() as conn:
        cursor = conn.cursor()

        # Purge this user's previous data to guarantee single active dataset lifecycle
        cursor.execute("DELETE FROM alerts WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM event_log WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM payments WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM invoices WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM renewals WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM transactions WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM customers WHERE user_id = ?", (user_id,))

        for df_name, df in dataframes.items():
            # Clean and sanitize column headers (strip BOM, whitespace, lowercase)
            cols_lower = {}
            for c in df.columns:
                clean_key = str(c).strip().lstrip('\ufeff').lower().replace(' ', '_').replace('-', '_')
                cols_lower[clean_key] = c

            df_ingested = False

            # 1. Ingest Customers if customer master fields present
            if any(k in cols_lower for k in ['customer_id', 'customerid', 'client_id', 'company_name', 'customer_name']):
                c_count = _ingest_customers(cursor, df, cols_lower, user_id)
                if c_count > 0:
                    records_processed += c_count
                    tables_updated.add("customers")
                    df_ingested = True

            # 2. Ingest Invoices if invoice fields present
            if any(k in cols_lower for k in ['invoice_id', 'invoiceid', 'invoiceno', 'invoice_no', 'billed_amount']):
                i_count = _ingest_invoices(cursor, df, cols_lower, user_id)
                if i_count > 0:
                    records_processed += i_count
                    tables_updated.add("invoices")
                    df_ingested = True

            # 3. Ingest Payments if payment fields present
            if any(k in cols_lower for k in ['payment_id', 'paymentid', 'pay_id', 'paid_amount', 'payment_status']):
                p_count = _ingest_payments(cursor, df, cols_lower, user_id)
                if p_count > 0:
                    records_processed += p_count
                    tables_updated.add("payments")
                    df_ingested = True

            # 4. Ingest Transactions if transaction fields present
            if any(k in cols_lower for k in ['transaction_id', 'txn_id']):
                t_count = _ingest_transactions(cursor, df, cols_lower, user_id)
                if t_count > 0:
                    records_processed += t_count
                    tables_updated.add("transactions")
                    df_ingested = True

            # 5. Ingest Renewals if renewal fields present
            if any(k in cols_lower for k in ['renewal_id', 'renewal_due']):
                r_count = _ingest_renewals(cursor, df, cols_lower, user_id)
                if r_count > 0:
                    records_processed += r_count
                    tables_updated.add("renewals")
                    df_ingested = True

    if records_processed == 0:
        raise ValueError(
            f"File '{filename}' contains data rows, but none match the required schema. "
            "Supported headers include: customer_id, invoice_id, payment_id, transaction_id, renewal_id."
        )

    # Refresh event log and trigger alert evaluation
    build_event_log(db_path)

    # Re-evaluate all detection rules & process conformance, updating DB alerts table
    from app.api.routes_alerts import rebuild_alerts
    rebuild_alerts(db_path=db_path, force=True)

    return {
        "filename": filename,
        "file_type": ext,
        "records_processed": records_processed,
        "tables_updated": list(tables_updated),
        "status": "success",
        "message": f"Successfully ingested {records_processed} records into {', '.join(tables_updated)} and refreshed leakage engine."
    }


def _find_col(cols_lower: dict, candidates: list) -> str:
    for cand in candidates:
        if cand in cols_lower:
            return cols_lower[cand]
    return None


def _ingest_customers(cursor, df, cols_lower, user_id: str = "system") -> int:
    cid_col = _find_col(cols_lower, ['customer_id', 'customerid', 'client_id', 'id'])
    name_col = _find_col(cols_lower, ['company_name', 'name', 'customer_name', 'client_name'])
    plan_col = _find_col(cols_lower, ['plan', 'plan_type', 'tier'])
    mrr_col = _find_col(cols_lower, ['plan_mrr_paise', 'mrr', 'monthly_price', 'price', 'billed_amount'])
    region_col = _find_col(cols_lower, ['region', 'location', 'zone'])
    segment_col = _find_col(cols_lower, ['segment', 'customer_segment'])

    count = 0
    for idx, row in df.iterrows():
        cid = str(row[cid_col]).strip() if cid_col and pd.notna(row[cid_col]) else f"CUST-UP-{idx+1:04d}"
        name = str(row[name_col]).strip() if name_col and pd.notna(row[name_col]) else f"Client {cid}"
        plan = str(row[plan_col]).strip() if plan_col and pd.notna(row[plan_col]) else "Enterprise"
        
        if segment_col and pd.notna(row[segment_col]):
            segment = str(row[segment_col]).strip().lower()
        else:
            segment = "enterprise" if "enterp" in plan.lower() else "smb"

        mrr_val = row[mrr_col] if mrr_col and pd.notna(row[mrr_col]) else 10000
        try:
            mrr_float = float(mrr_val)
            mrr_paise = int(mrr_float * 100) if mrr_float < 100000 else int(mrr_float)
        except Exception:
            mrr_paise = 1000000

        created_at = "2024-01-15"
        region = str(row[region_col]).strip() if region_col and pd.notna(row[region_col]) else "North"

        cursor.execute("""
            INSERT OR REPLACE INTO customers (customer_id, name, segment, plan, plan_mrr_paise, created_at, region, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (cid, name, segment, plan, mrr_paise, created_at, region, user_id))
        count += 1
    return count


def _ingest_invoices(cursor, df, cols_lower, user_id: str = "system") -> int:
    inv_col = _find_col(cols_lower, ['invoice_id', 'invoiceid', 'invoiceno', 'invoice_no'])
    cid_col = _find_col(cols_lower, ['customer_id', 'customerid', 'client_id'])
    amt_col = _find_col(cols_lower, ['amount_paise', 'amount', 'price', 'total', 'billed_amount'])
    date_col = _find_col(cols_lower, ['issue_date', 'invoicedate', 'date', 'created_at'])
    due_col = _find_col(cols_lower, ['due_date', 'duedate'])
    disc_col = _find_col(cols_lower, ['discount_pct', 'discount', 'disc'])
    status_col = _find_col(cols_lower, ['status', 'invoice_status'])
    contract_col = _find_col(cols_lower, ['contract_ref', 'contract_id'])

    count = 0
    for idx, row in df.iterrows():
        inv_id = str(row[inv_col]).strip() if inv_col and pd.notna(row[inv_col]) else f"INV-UP-{idx+1:05d}"
        cid = str(row[cid_col]).strip() if cid_col and pd.notna(row[cid_col]) else "CUST-0042"

        amt_val = row[amt_col] if amt_col and pd.notna(row[amt_col]) else 50000
        try:
            amt_float = float(amt_val)
            amt_paise = int(amt_float * 100) if amt_float < 500000 else int(amt_float)
        except Exception:
            amt_paise = 5000000

        iss_date = str(row[date_col])[:10] if date_col and pd.notna(row[date_col]) else "2025-05-01"
        if due_col and pd.notna(row[due_col]):
            due_date = str(row[due_col])[:10]
        else:
            try:
                iss_dt = datetime.strptime(iss_date, "%Y-%m-%d")
                due_date = (iss_dt + timedelta(days=30)).strftime("%Y-%m-%d")
            except Exception:
                iss_date = "2025-05-01"
                due_date = "2025-06-01"

        disc_pct = 0.0
        if disc_col and pd.notna(row[disc_col]):
            try:
                disc_pct = float(row[disc_col])
                if disc_pct > 1.0:
                    disc_pct = disc_pct / 100.0
            except Exception:
                disc_pct = 0.0

        status = str(row[status_col]).strip() if status_col and pd.notna(row[status_col]) else "issued"
        contract_ref = str(row[contract_col]).strip() if contract_col and pd.notna(row[contract_col]) else f"CTR-{cid}"

        cursor.execute("""
            INSERT OR REPLACE INTO invoices (invoice_id, customer_id, issue_date, due_date, amount_paise, discount_pct, status, contract_ref, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (inv_id, cid, iss_date, due_date, amt_paise, disc_pct, status, contract_ref, user_id))
        count += 1
    return count


def _ingest_payments(cursor, df, cols_lower, user_id: str = "system") -> int:
    pid_col = _find_col(cols_lower, ['payment_id', 'paymentid', 'pay_id'])
    inv_col = _find_col(cols_lower, ['invoice_id', 'invoiceid'])
    cid_col = _find_col(cols_lower, ['customer_id', 'customerid'])
    amt_col = _find_col(cols_lower, ['amount_paise', 'amount', 'paid_amount'])
    status_col = _find_col(cols_lower, ['status', 'payment_status'])
    method_col = _find_col(cols_lower, ['payment_method', 'method'])
    ts_col = _find_col(cols_lower, ['payment_ts', 'pay_ts', 'timestamp'])

    count = 0
    for idx, row in df.iterrows():
        pid = str(row[pid_col]).strip() if pid_col and pd.notna(row[pid_col]) else f"PAY-UP-{idx+1:05d}"
        inv_id = str(row[inv_col]).strip() if inv_col and pd.notna(row[inv_col]) else f"INV-1001"
        cid = str(row[cid_col]).strip() if cid_col and pd.notna(row[cid_col]) else "CUST-0042"

        amt_val = row[amt_col] if amt_col and pd.notna(row[amt_col]) else 50000
        try:
            amt_float = float(amt_val)
            amt_paise = int(amt_float * 100) if amt_float < 500000 else int(amt_float)
        except Exception:
            amt_paise = 5000000

        status = str(row[status_col]).strip() if status_col and pd.notna(row[status_col]) else "success"
        method = str(row[method_col]).strip() if method_col and pd.notna(row[method_col]) else "upi"
        pay_ts = str(row[ts_col]) if ts_col and pd.notna(row[ts_col]) else "2025-05-02T10:00:00Z"

        cursor.execute("""
            INSERT OR REPLACE INTO payments (payment_id, invoice_id, customer_id, amount_paise, method, status, payment_ts, attempt_no, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (pid, inv_id, cid, amt_paise, method, status, pay_ts, 1, user_id))
        count += 1
    return count


def _ingest_transactions(cursor, df, cols_lower, user_id: str = "system") -> int:
    tid_col = _find_col(cols_lower, ['transaction_id', 'txn_id', 'tx_id'])
    cid_col = _find_col(cols_lower, ['customer_id', 'customerid'])
    amt_col = _find_col(cols_lower, ['amount_paise', 'amount', 'paid_amount', 'billed_amount'])
    type_col = _find_col(cols_lower, ['type', 'txn_type', 'transaction_type'])
    ts_col = _find_col(cols_lower, ['txn_ts', 'transaction_date', 'issue_date', 'date'])

    count = 0
    for idx, row in df.iterrows():
        tid = str(row[tid_col]).strip() if tid_col and pd.notna(row[tid_col]) else f"TXN-UP-{idx+1:05d}"
        cid = str(row[cid_col]).strip() if cid_col and pd.notna(row[cid_col]) else "CUST-0042"

        amt_val = row[amt_col] if amt_col and pd.notna(row[amt_col]) else 50000
        try:
            amt_float = float(amt_val)
            amt_paise = int(amt_float * 100) if amt_float < 500000 else int(amt_float)
        except Exception:
            amt_paise = 5000000

        ttype = str(row[type_col]).strip() if type_col and pd.notna(row[type_col]) else "purchase"
        tts = str(row[ts_col])[:10] if ts_col and pd.notna(row[ts_col]) else "2025-05-01"

        cursor.execute("""
            INSERT OR REPLACE INTO transactions (txn_id, customer_id, amount_paise, type, txn_ts, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (tid, cid, amt_paise, ttype, tts, user_id))
        count += 1
    return count


def _ingest_renewals(cursor, df, cols_lower, user_id: str = "system") -> int:
    rid_col = _find_col(cols_lower, ['renewal_id', 'ren_id'])
    cid_col = _find_col(cols_lower, ['customer_id', 'customerid'])
    date_col = _find_col(cols_lower, ['due_date', 'renewal_due', 'date'])
    status_col = _find_col(cols_lower, ['status', 'renewal_status'])

    count = 0
    for idx, row in df.iterrows():
        rid = str(row[rid_col]).strip() if rid_col and pd.notna(row[rid_col]) else f"REN-UP-{idx+1:05d}"
        cid = str(row[cid_col]).strip() if cid_col and pd.notna(row[cid_col]) else "CUST-0042"
        due_date = str(row[date_col])[:10] if date_col and pd.notna(row[date_col]) else "2025-06-01"
        status = str(row[status_col]).strip() if status_col and pd.notna(row[status_col]) else "pending"

        cursor.execute("""
            INSERT OR REPLACE INTO renewals (renewal_id, customer_id, due_date, status, attempt_count, last_attempt_ts, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (rid, cid, due_date, status, 1, "2025-05-15T12:00:00Z", user_id))
        count += 1
    return count
