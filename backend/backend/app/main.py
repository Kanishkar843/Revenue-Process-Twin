"""
Revenue Process Twin - FastAPI entrypoint.
sys.path must be set to this directory first to prevent namespace collision with other projects.
"""
import os
import sys

_curr_dir = os.path.dirname(os.path.abspath(__file__))
_parent_dir = os.path.dirname(_curr_dir)
if _parent_dir not in sys.path:
    sys.path.insert(0, _parent_dir)

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import (
    routes_alerts,
    routes_customer,
    routes_summary,
    routes_chat,
    routes_actions,
    routes_health,
    routes_upload,
    routes_ingestion,
    routes_streams,
    routes_auth,
    routes_audit,
    routes_invoices,
    routes_transactions,
    routes_recovery,
    routes_processes,
    routes_export
)

app = FastAPI(
    title="Revenue Process Twin API",
    description="Universal Data Ingestion & Conformance Detection Engine API",
    version="2.0.0"
)

# Run database migration on startup to guarantee user_id columns & business_profiles exist
@app.on_event("startup")
def startup_db_migration():
    try:
        from app.db.migrations.add_user_id import migrate
        migrate()
    except Exception as e:
        print(f"Startup DB Migration warning: {e}")

# CORS configuration for local dev and Render production frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "https://revenue-process-twin-frontend.onrender.com",
    ],
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Core 7 Analytical Routes
app.include_router(routes_alerts.router)
app.include_router(routes_customer.router)
app.include_router(routes_summary.router)
app.include_router(routes_chat.router)
app.include_router(routes_actions.router)
app.include_router(routes_health.router)
app.include_router(routes_upload.router)

# Universal Ingestion & Streaming Gateways
app.include_router(routes_ingestion.router)
app.include_router(routes_streams.router)
app.include_router(routes_auth.router)
app.include_router(routes_audit.router)

# Invoices, Transactions, Recovery & Processes Routes
app.include_router(routes_invoices.router)
app.include_router(routes_transactions.router)
app.include_router(routes_recovery.router)
app.include_router(routes_processes.router)
app.include_router(routes_export.router)

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from fastapi.responses import Response
    return Response(status_code=204)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
