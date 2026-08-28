import sqlite3
from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from app.db.connection import get_connection

router = APIRouter()

@router.get("/api/invoices")
def get_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    status: Optional[str] = None,
    customer_id: Optional[str] = None
):
    """Returns paginated real invoices directly from SQLite invoices table."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        where_clauses = []
        params = []
        if status:
            where_clauses.append("i.status = ?")
            params.append(status)
        if customer_id:
            where_clauses.append("i.customer_id = ?")
            params.append(customer_id)
            
        where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        
        count_query = f"SELECT COUNT(*) FROM invoices i {where_str};"
        total = cursor.execute(count_query, params).fetchone()[0]
        
        offset = (page - 1) * page_size
        query = f"""
            SELECT i.invoice_id, i.customer_id, c.name as customer_name, i.amount_paise,
                   i.discount_pct, i.issue_date, i.due_date, i.status, i.contract_ref
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.customer_id
            {where_str}
            ORDER BY i.issue_date DESC
            LIMIT ? OFFSET ?;
        """
        params.extend([page_size, offset])
        rows = cursor.execute(query, params).fetchall()
        
        invoices = []
        for r in rows:
            invoices.append({
                "invoice_id": r["invoice_id"],
                "customer_id": r["customer_id"],
                "customer_name": r["customer_name"] or r["customer_id"],
                "amount_rs": float(r["amount_paise"]) / 100.0 if r["amount_paise"] else 0.0,
                "discount_pct": float(r["discount_pct"]) if r["discount_pct"] else 0.0,
                "issue_date": r["issue_date"],
                "due_date": r["due_date"],
                "status": r["status"],
                "contract_ref": r["contract_ref"] or ""
            })
            
        return {
            "page": page,
            "page_size": page_size,
            "total": total,
            "invoices": invoices
        }

@router.get("/api/invoices/{invoice_id}")
def get_invoice_detail(invoice_id: str):
    """Returns details for a specific invoice."""
    with get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute("""
            SELECT i.*, c.name as customer_name
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.customer_id
            WHERE i.invoice_id = ?;
        """, (invoice_id,)).fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Invoice not found")
            
        return {
            "invoice_id": row["invoice_id"],
            "customer_id": row["customer_id"],
            "customer_name": row["customer_name"] or row["customer_id"],
            "amount_rs": float(row["amount_paise"]) / 100.0 if row["amount_paise"] else 0.0,
            "discount_pct": float(row["discount_pct"]) if row["discount_pct"] else 0.0,
            "issue_date": row["issue_date"],
            "due_date": row["due_date"],
            "status": row["status"],
            "contract_ref": row["contract_ref"] or ""
        }
