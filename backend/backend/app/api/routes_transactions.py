import sqlite3
from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from app.db.connection import get_connection

router = APIRouter()

@router.get("/api/transactions")
def get_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    type: Optional[str] = None,
    customer_id: Optional[str] = None
):
    """Returns paginated real transactions directly from SQLite transactions table."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        where_clauses = []
        params = []
        if type:
            where_clauses.append("t.type = ?")
            params.append(type)
        if customer_id:
            where_clauses.append("t.customer_id = ?")
            params.append(customer_id)
            
        where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        
        count_query = f"SELECT COUNT(*) FROM transactions t {where_str};"
        total = cursor.execute(count_query, params).fetchone()[0]
        
        offset = (page - 1) * page_size
        query = f"""
            SELECT t.txn_id, t.customer_id, c.name as customer_name, t.type,
                   t.amount_paise, t.txn_ts
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.customer_id
            {where_str}
            ORDER BY t.txn_ts DESC
            LIMIT ? OFFSET ?;
        """
        params.extend([page_size, offset])
        rows = cursor.execute(query, params).fetchall()
        
        transactions = []
        for r in rows:
            transactions.append({
                "txn_id": r["txn_id"],
                "customer_id": r["customer_id"],
                "customer_name": r["customer_name"] or r["customer_id"],
                "type": r["type"],
                "amount_rs": float(r["amount_paise"]) / 100.0 if r["amount_paise"] else 0.0,
                "txn_ts": r["txn_ts"]
            })
            
        return {
            "page": page,
            "page_size": page_size,
            "total": total,
            "transactions": transactions
        }
