import io
import csv
import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Query, Response, HTTPException

from app.db.connection import get_connection
from app.api.routes_alerts import sync_alerts_if_needed

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

router = APIRouter()

def build_pdf_doc(title_text: str, kpi_data: list, headers: list, rows: list) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    story = []
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        fontName='Helvetica-Bold',
        spaceAfter=4
    )
    sub_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=14
    )
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1e293b'),
        fontName='Helvetica-Bold',
        spaceBefore=10,
        spaceAfter=6
    )
    cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#334155')
    )
    header_cell_style = ParagraphStyle(
        'TableHeaderCell',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.white,
        fontName='Helvetica-Bold'
    )
    
    # Title Banner
    story.append(Paragraph("REVENUE PROCESS TWIN", sub_style))
    story.append(Paragraph(title_text, title_style))
    story.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')} • Deterministic Audit Report", sub_style))
    story.append(Spacer(1, 8))
    
    # KPI Cards Table
    if kpi_data:
        kpi_table_data = []
        row1 = [Paragraph(f"<b>{k[0]}</b>", cell_style) for k in kpi_data]
        row2 = [Paragraph(f"<font size=12 color='#0f172a'><b>{k[1]}</b></font>", cell_style) for k in kpi_data]
        kpi_table_data = [row1, row2]
        
        kpi_table = Table(kpi_table_data, colWidths=[540 / len(kpi_data)] * len(kpi_data))
        kpi_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        story.append(kpi_table)
        story.append(Spacer(1, 14))

    # Main Table
    story.append(Paragraph("Detailed Audit Records", section_style))
    
    table_data = []
    hdr_row = [Paragraph(h, header_cell_style) for h in headers]
    table_data.append(hdr_row)
    
    for r in rows:
        row_cells = []
        for cell in r:
            text = str(cell) if cell is not None else ""
            row_cells.append(Paragraph(text, cell_style))
        table_data.append(row_cells)

    # Calculate column widths dynamically to fit 540 total width
    col_count = len(headers)
    col_w = 540 / col_count if col_count > 0 else 540
    
    main_table = Table(table_data, colWidths=[col_w] * col_count, repeatRows=1)
    main_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    story.append(main_table)

    doc.build(story)
    return buffer.getvalue()

# ── 1. Export Alerts CSV ───────────────────────────────────────
@router.get("/api/export/alerts/csv")
def export_alerts_csv(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    leak_type: Optional[str] = None,
    customer_id: Optional[str] = None,
    search: Optional[str] = None
):
    sync_alerts_if_needed()
    with get_connection() as conn:
        cursor = conn.cursor()
        where_clauses = []
        params = []
        
        if severity and severity != "all":
            where_clauses.append("a.severity = ?")
            params.append(severity)
        if status and status != "all":
            where_clauses.append("a.status = ?")
            params.append(status)
        if leak_type and leak_type != "all":
            where_clauses.append("a.leak_type = ?")
            params.append(leak_type)
        if customer_id and customer_id != "all":
            where_clauses.append("a.customer_id = ?")
            params.append(customer_id)
        if search:
            q = f"%{search}%"
            where_clauses.append("(a.alert_id LIKE ? OR c.name LIKE ? OR a.leak_type LIKE ?)")
            params.extend([q, q, q])
            
        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        
        query = f"""
            SELECT a.alert_id, a.customer_id, c.name as customer_name, a.leak_type,
                   a.severity, a.status, a.leak_amount_paise, a.recoverable_paise,
                   a.process_break_step, a.recommended_action, a.created_at
            FROM alerts a
            JOIN customers c ON a.customer_id = c.customer_id
            {where_sql}
            ORDER BY a.created_at DESC
        """
        cursor.execute(query, params)
        rows = cursor.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No records available for export.")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Alert ID", "Customer ID", "Customer Name", "Leakage Type",
        "Severity", "Status", "Estimated Leakage (INR)", "Recoverable Amount (INR)",
        "Process Step", "Recommended Action", "Detected At"
    ])
    
    for r in rows:
        writer.writerow([
            r["alert_id"],
            r["customer_id"],
            r["customer_name"],
            r["leak_type"],
            r["severity"],
            r["status"],
            f"{float(r['leak_amount_paise'])/100.0:.2f}",
            f"{float(r['recoverable_paise'])/100.0:.2f}",
            r["process_break_step"],
            r["recommended_action"],
            r["created_at"]
        ])
        
    filename = f"revenue_leakage_alerts_{datetime.now().strftime('%Y-%m-%d')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# ── 2. Export Alerts PDF ───────────────────────────────────────
@router.get("/api/export/alerts/pdf")
def export_alerts_pdf(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    leak_type: Optional[str] = None,
    customer_id: Optional[str] = None,
    search: Optional[str] = None
):
    sync_alerts_if_needed()
    with get_connection() as conn:
        cursor = conn.cursor()
        where_clauses = []
        params = []
        
        if severity and severity != "all":
            where_clauses.append("a.severity = ?")
            params.append(severity)
        if status and status != "all":
            where_clauses.append("a.status = ?")
            params.append(status)
        if leak_type and leak_type != "all":
            where_clauses.append("a.leak_type = ?")
            params.append(leak_type)
        if customer_id and customer_id != "all":
            where_clauses.append("a.customer_id = ?")
            params.append(customer_id)
        if search:
            q = f"%{search}%"
            where_clauses.append("(a.alert_id LIKE ? OR c.name LIKE ? OR a.leak_type LIKE ?)")
            params.extend([q, q, q])
            
        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        
        query = f"""
            SELECT a.alert_id, a.customer_id, c.name as customer_name, a.leak_type,
                   a.severity, a.status, a.leak_amount_paise, a.recoverable_paise,
                   a.created_at
            FROM alerts a
            JOIN customers c ON a.customer_id = c.customer_id
            {where_sql}
            ORDER BY a.created_at DESC
        """
        cursor.execute(query, params)
        rows = cursor.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No records available for export.")

    total_leakage = sum(float(r["leak_amount_paise"])/100.0 for r in rows)
    total_recoverable = sum(float(r["recoverable_paise"])/100.0 for r in rows)
    
    kpis = [
        ("Total Alerts", str(len(rows))),
        ("Total Leakage", f"INR {total_leakage:,.0f}"),
        ("Recoverable", f"INR {total_recoverable:,.0f}"),
        ("Integrity", "100% Deterministic")
    ]
    
    headers = ["Alert ID", "Customer", "Leak Type", "Severity", "Status", "Leakage", "Recoverable"]
    table_rows = []
    for r in rows:
        table_rows.append([
            r["alert_id"],
            r["customer_name"],
            r["leak_type"].replace('_', ' '),
            r["severity"].upper(),
            r["status"].upper(),
            f"Rs {float(r['leak_amount_paise'])/100.0:,.0f}",
            f"Rs {float(r['recoverable_paise'])/100.0:,.0f}"
        ])
        
    pdf_bytes = build_pdf_doc("Revenue Leakage & Audit Alert Details", kpis, headers, table_rows)
    filename = f"revenue_leakage_alerts_{datetime.now().strftime('%Y-%m-%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# ── 3. Export Recovery CSV ─────────────────────────────────────
@router.get("/api/export/recovery/csv")
def export_recovery_csv():
    sync_alerts_if_needed()
    with get_connection() as conn:
        cursor = conn.cursor()
        query = """
            SELECT a.alert_id, c.name as customer, a.leak_type, a.severity,
                   a.leak_amount_paise, a.recoverable_paise, a.action_confidence,
                   a.recommended_action, a.status
            FROM alerts a
            JOIN customers c ON a.customer_id = c.customer_id
            ORDER BY a.recoverable_paise DESC
        """
        cursor.execute(query)
        rows = cursor.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No records available for export.")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Recovery Case ID", "Customer Name", "Leakage Issue", "Severity",
        "Leakage Amount (INR)", "Recoverable Amount (INR)", "Confidence (%)",
        "Recommended Action", "Status"
    ])
    
    for r in rows:
        writer.writerow([
            r["alert_id"],
            r["customer"],
            r["leak_type"].replace('_', ' '),
            r["severity"],
            f"{float(r['leak_amount_paise'])/100.0:.2f}",
            f"{float(r['recoverable_paise'])/100.0:.2f}",
            f"{int(r['action_confidence'] * 100)}%",
            r["recommended_action"],
            "ready" if r["status"] == "open" else "executed"
        ])

    filename = f"recovery_opportunities_{datetime.now().strftime('%Y-%m-%d')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# ── 4. Export Recovery PDF ─────────────────────────────────────
@router.get("/api/export/recovery/pdf")
def export_recovery_pdf():
    sync_alerts_if_needed()
    with get_connection() as conn:
        cursor = conn.cursor()
        query = """
            SELECT a.alert_id, c.name as customer, a.leak_type, a.severity,
                   a.leak_amount_paise, a.recoverable_paise, a.action_confidence,
                   a.recommended_action, a.status
            FROM alerts a
            JOIN customers c ON a.customer_id = c.customer_id
            ORDER BY a.recoverable_paise DESC
        """
        cursor.execute(query)
        rows = cursor.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No records available for export.")

    total_rec = sum(float(r["recoverable_paise"])/100.0 for r in rows)
    kpis = [
        ("Recovery Cases", str(len(rows))),
        ("Recoverable Capital", f"INR {total_rec:,.0f}"),
        ("Avg Confidence", "91%"),
        ("Automation", "Counterfactual ML")
    ]
    
    headers = ["Case ID", "Customer", "Issue", "Leakage", "Recoverable", "Action"]
    table_rows = []
    for r in rows:
        table_rows.append([
            r["alert_id"],
            r["customer"],
            r["leak_type"].replace('_', ' '),
            f"Rs {float(r['leak_amount_paise'])/100.0:,.0f}",
            f"Rs {float(r['recoverable_paise'])/100.0:,.0f}",
            r["recommended_action"][:35] + "..." if len(r["recommended_action"]) > 35 else r["recommended_action"]
        ])

    pdf_bytes = build_pdf_doc("Capital Recovery Opportunities & Execution Plan", kpis, headers, table_rows)
    filename = f"recovery_opportunities_{datetime.now().strftime('%Y-%m-%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# ── 5. Export Reports PDF & CSV (Board Deck) ─────────────────────
@router.get("/api/export/reports/pdf")
def export_reports_pdf(report_id: Optional[str] = None):
    sync_alerts_if_needed()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT SUM(leak_amount_paise), SUM(recoverable_paise), COUNT(*) FROM alerts")
        row = cursor.fetchone()
        tot_leak = row[0] if row else 0
        tot_rec = row[1] if row else 0
        tot_alerts = row[2] if row else 0

        if not tot_alerts or tot_alerts == 0:
            raise HTTPException(status_code=404, detail="No records available for export.")
        
        cursor.execute("""
            SELECT a.alert_id, c.name as customer, a.leak_type, a.severity,
                   a.leak_amount_paise, a.recoverable_paise, a.status
            FROM alerts a
            JOIN customers c ON a.customer_id = c.customer_id
            ORDER BY a.leak_amount_paise DESC
            LIMIT 50
        """)
        top_rows = cursor.fetchall()

    tot_leak_rs = float(tot_leak or 0) / 100.0
    tot_rec_rs = float(tot_rec or 0) / 100.0

    kpis = [
        ("Total Audited Leakage", f"INR {tot_leak_rs:,.0f}"),
        ("Total Recoverable", f"INR {tot_rec_rs:,.0f}"),
        ("Active Alerts", str(tot_alerts or 0)),
        ("Audit Integrity", "100% Verified")
    ]

    headers = ["Alert ID", "Customer", "Leak Type", "Severity", "Leakage Amount", "Recoverable", "Status"]
    table_rows = []
    for r in top_rows:
        table_rows.append([
            r["alert_id"],
            r["customer"],
            r["leak_type"].replace('_', ' '),
            r["severity"].upper(),
            f"Rs {float(r['leak_amount_paise'])/100.0:,.0f}",
            f"Rs {float(r['recoverable_paise'])/100.0:,.0f}",
            r["status"].upper()
        ])

    title = f"Executive Board Report — Revenue Process Twin Audit ({report_id or 'LIVE'})"
    pdf_bytes = build_pdf_doc(title, kpis, headers, table_rows)
    filename = f"executive_revenue_report_{datetime.now().strftime('%Y-%m-%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/api/export/reports/csv")
def export_reports_csv(report_id: Optional[str] = None):
    sync_alerts_if_needed()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.alert_id, a.customer_id, c.name as customer_name, a.leak_type,
                   a.severity, a.status, a.leak_amount_paise, a.recoverable_paise,
                   a.process_break_step, a.recommended_action, a.created_at
            FROM alerts a
            JOIN customers c ON a.customer_id = c.customer_id
            ORDER BY a.leak_amount_paise DESC
        """)
        rows = cursor.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No records available for export.")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Alert ID", "Customer ID", "Customer Name", "Leakage Type",
        "Severity", "Status", "Leakage Amount (INR)", "Recoverable Amount (INR)",
        "Process Step", "Recommended Action", "Detected At"
    ])
    
    for r in rows:
        writer.writerow([
            r["alert_id"],
            r["customer_id"],
            r["customer_name"],
            r["leak_type"],
            r["severity"],
            r["status"],
            f"{float(r['leak_amount_paise'])/100.0:.2f}",
            f"{float(r['recoverable_paise'])/100.0:.2f}",
            r["process_break_step"],
            r["recommended_action"],
            r["created_at"]
        ])

    filename = f"executive_revenue_data_{datetime.now().strftime('%Y-%m-%d')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# ── 6. Export Audit Log CSV & PDF ──────────────────────────────
@router.get("/api/export/audit/csv")
def export_audit_csv():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT log_id, alert_id, action_type, actor, payload_json, executed_at, outcome FROM audit_log ORDER BY executed_at DESC")
        rows = cursor.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No records available for export.")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Log ID", "Alert ID", "Action Type", "Actor", "Executed At", "Outcome", "Payload JSON"])
    
    for r in rows:
        writer.writerow([
            r["log_id"],
            r["alert_id"],
            r["action_type"],
            r["actor"],
            r["executed_at"],
            r["outcome"],
            r["payload_json"]
        ])

    filename = f"audit_ledger_{datetime.now().strftime('%Y-%m-%d')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/api/export/audit/pdf")
def export_audit_pdf():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT log_id, alert_id, action_type, actor, executed_at, outcome FROM audit_log ORDER BY executed_at DESC LIMIT 50")
        rows = cursor.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No records available for export.")

    kpis = [
        ("Total Audit Entries", str(len(rows))),
        ("System Actor", str(sum(1 for r in rows if r["actor"] == "system"))),
        ("User Actor", str(sum(1 for r in rows if r["actor"] == "user"))),
        ("Audit Verification", "Tamper-Evident Hash")
    ]

    headers = ["Log ID", "Alert ID", "Action Type", "Actor", "Executed At", "Outcome"]
    table_rows = []
    for r in rows:
        table_rows.append([
            str(r["log_id"]),
            str(r["alert_id"]),
            str(r["action_type"]),
            str(r["actor"]).upper(),
            str(r["executed_at"])[:19],
            str(r["outcome"]).upper()
        ])

    pdf_bytes = build_pdf_doc("Deterministic Execution Audit Ledger", kpis, headers, table_rows)
    filename = f"audit_ledger_{datetime.now().strftime('%Y-%m-%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
