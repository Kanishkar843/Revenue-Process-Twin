import os
import sqlite3
from fastapi import APIRouter

router = APIRouter()
DB_PATH = "data/final/revenue_leaks.db"

@router.get("/api/health")
def get_health():
    db_status = "disconnected"
    try:
        if os.path.exists(DB_PATH):
            conn = sqlite3.connect(DB_PATH)
            conn.execute("SELECT 1;")
            conn.close()
            db_status = "connected"
    except Exception:
        db_status = "error"

    model_loaded = os.path.exists("ml/models/churn_xgb.pkl") and os.path.exists("ml/models/isolation_forest.pkl")
    narrator_mode = os.environ.get("NARRATOR_MODE", "live").lower()

    ollama_status = "unavailable"
    ollama_model = os.environ.get("OLLAMA_MODEL", "revenue-qwen35-4b:latest")
    try:
        import urllib.request
        req = urllib.request.urlopen("http://localhost:11434/api/tags", timeout=2)
        if req.status == 200:
            ollama_status = "running"
    except Exception:
        ollama_status = "unavailable"

    return {
        "status": "ok",
        "db": db_status,
        "model_loaded": model_loaded,
        "narrator_mode": narrator_mode,
        "ollama_status": ollama_status,
        "ollama_model": ollama_model
    }
