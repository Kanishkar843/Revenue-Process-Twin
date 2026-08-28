import sqlite3
import json
import uuid

def build_event_log(db_path: str, user_id: str = "system") -> int:
    """
    Reads customers, invoices, payments, transactions, renewals from SQLite
    and populates event_log with ordered entity event sequences for a specific user_id.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("DELETE FROM event_log WHERE user_id = ?;", (user_id,))
    events = []

    # 1. Customer contract approvals
    cursor.execute("SELECT customer_id, segment, plan, created_at FROM customers WHERE user_id = ?;", (user_id,))
    customers = cursor.fetchall()
    for c in customers:
        user_suffix = user_id[:6] if user_id else "sys"
        events.append({
            "event_id": f"EVT-CUST-{c['customer_id']}-{user_suffix}",
            "user_id": user_id,
            "entity_id": c["customer_id"],
            "entity_type": "customer",
            "event_type": "CONTRACT_APPROVED",
            "event_ts": f"{c['created_at']}T00:00:00Z",
            "metadata_json": json.dumps({"segment": c["segment"], "plan": c["plan"]}),
            "created_at": f"{c['created_at']}T00:00:00Z"
        })

    # 2. Invoices (ISSUED, DISCOUNT_APPLIED, DISCOUNT_APPROVED)
    cursor.execute("SELECT invoice_id, customer_id, issue_date, amount_paise, discount_pct, status, contract_ref FROM invoices WHERE user_id = ?;", (user_id,))
    invoices = cursor.fetchall()
    for inv in invoices:
        issue_ts = f"{inv['issue_date']}T09:00:00Z"
        user_suffix = user_id[:6] if user_id else "sys"
        
        # If discount applied
        if inv["discount_pct"] > 0:
            disc_ts = f"{inv['issue_date']}T08:30:00Z"
            events.append({
                "event_id": f"EVT-DISC-{inv['invoice_id']}-{user_suffix}",
                "user_id": user_id,
                "entity_id": inv["invoice_id"],
                "entity_type": "invoice",
                "event_type": "DISCOUNT_APPLIED",
                "event_ts": disc_ts,
                "metadata_json": json.dumps({
                    "customer_id": inv["customer_id"],
                    "discount_pct": inv["discount_pct"],
                    "amount_paise": inv["amount_paise"]
                }),
                "created_at": disc_ts
            })
            
            # DISCOUNT_APPROVED event (only if standard discount <= 20%)
            if inv["discount_pct"] <= 0.20:
                appr_ts = f"{inv['issue_date']}T08:45:00Z"
                events.append({
                    "event_id": f"EVT-DISC-APPR-{inv['invoice_id']}-{user_suffix}",
                    "user_id": user_id,
                    "entity_id": inv["invoice_id"],
                    "entity_type": "invoice",
                    "event_type": "DISCOUNT_APPROVED",
                    "event_ts": appr_ts,
                    "metadata_json": json.dumps({
                        "customer_id": inv["customer_id"],
                        "approver_id": "AP-SYSTEM" if inv["customer_id"] != "CUST-0031" else None
                    }),
                    "created_at": appr_ts
                })

        events.append({
            "event_id": f"EVT-INV-{inv['invoice_id']}-{user_suffix}",
            "user_id": user_id,
            "entity_id": inv["invoice_id"],
            "entity_type": "invoice",
            "event_type": "INVOICE_ISSUED",
            "event_ts": issue_ts,
            "metadata_json": json.dumps({
                "customer_id": inv["customer_id"],
                "amount_paise": inv["amount_paise"],
                "contract_ref": inv["contract_ref"],
                "status": inv["status"]
            }),
            "created_at": issue_ts
        })

    # 3. Payments
    cursor.execute("SELECT payment_id, invoice_id, customer_id, amount_paise, method, status, payment_ts, attempt_no FROM payments WHERE user_id = ?;", (user_id,))
    payments = cursor.fetchall()
    for p in payments:
        pmt_ts = p["payment_ts"] or "2025-06-01T10:00:00Z"
        user_suffix = user_id[:6] if user_id else "sys"
        events.append({
            "event_id": f"EVT-PAY-ATT-{p['payment_id']}-{user_suffix}",
            "user_id": user_id,
            "entity_id": p["invoice_id"],
            "entity_type": "payment",
            "event_type": "PAYMENT_ATTEMPTED",
            "event_ts": pmt_ts,
            "metadata_json": json.dumps({
                "payment_id": p["payment_id"],
                "customer_id": p["customer_id"],
                "amount_paise": p["amount_paise"],
                "attempt_no": p["attempt_no"]
            }),
            "created_at": pmt_ts
        })

        if p["status"] in ("success", "duplicate"):
            evt_type = "PAYMENT_SUCCEEDED"
        elif p["status"] == "failed":
            evt_type = "PAYMENT_FAILED"
        elif p["status"] == "refunded":
            evt_type = "REFUND_ISSUED"
        elif p["status"] == "chargeback":
            evt_type = "CHARGEBACK_RAISED"
        else:
            evt_type = "PAYMENT_ATTEMPTED"

        events.append({
            "event_id": f"EVT-PAY-OUT-{p['payment_id']}-{user_suffix}",
            "user_id": user_id,
            "entity_id": p["invoice_id"],
            "entity_type": "payment",
            "event_type": evt_type,
            "event_ts": pmt_ts,
            "metadata_json": json.dumps({
                "payment_id": p["payment_id"],
                "customer_id": p["customer_id"],
                "amount_paise": p["amount_paise"],
                "status": p["status"]
            }),
            "created_at": pmt_ts
        })

    # 4. Renewals
    cursor.execute("SELECT renewal_id, customer_id, due_date, status, attempt_count, last_attempt_ts FROM renewals WHERE user_id = ?;", (user_id,))
    renewals = cursor.fetchall()
    for r in renewals:
        due_ts = f"{r['due_date']}T00:00:00Z"
        user_suffix = user_id[:6] if user_id else "sys"
        events.append({
            "event_id": f"EVT-REN-DUE-{r['renewal_id']}-{user_suffix}",
            "user_id": user_id,
            "entity_id": r["renewal_id"],
            "entity_type": "renewal",
            "event_type": "RENEWAL_DUE",
            "event_ts": due_ts,
            "metadata_json": json.dumps({"customer_id": r["customer_id"]}),
            "created_at": due_ts
        })

        if r["status"] == "renewed":
            status_evt = "RENEWAL_SUCCEEDED"
        elif r["status"] in ("missed", "failed_payment"):
            status_evt = "RENEWAL_MISSED"
        else:
            status_evt = "RENEWAL_DUE"

        ren_ts = r["last_attempt_ts"] or due_ts
        events.append({
            "event_id": f"EVT-REN-STAT-{r['renewal_id']}-{user_suffix}",
            "user_id": user_id,
            "entity_id": r["renewal_id"],
            "entity_type": "renewal",
            "event_type": status_evt,
            "event_ts": ren_ts,
            "metadata_json": json.dumps({"customer_id": r["customer_id"], "status": r["status"]}),
            "created_at": ren_ts
        })

    # Bulk insert event log
    cursor.executemany(
        """INSERT INTO event_log (event_id, user_id, entity_id, entity_type, event_type, event_ts, metadata_json, created_at)
           VALUES (:event_id, :user_id, :entity_id, :entity_type, :event_type, :event_ts, :metadata_json, :created_at)""",
        events
    )
    conn.commit()
    count = len(events)
    conn.close()
    return count
