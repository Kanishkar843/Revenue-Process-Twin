from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Query, Depends
from app.db.connection import get_connection, get_db_path
from app.services.conformance_engine import evaluate_conformance
from app.services.detection_rules import evaluate_rules
from app.services.counterfactual_engine import calculate_recoverable_paise
from app.services.auth_service import get_current_user

router = APIRouter()

@router.get("/api/recoverable-summary")
def get_recoverable_summary(
    period: Optional[str] = Query("30d"),
    group_by: Optional[str] = Query("leak_type"),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub", "system")
    db_path = get_db_path()
    raw_rule = evaluate_rules(db_path)
    raw_conf = evaluate_conformance(db_path)

    combined = []
    seen = set()
    for item in raw_rule + raw_conf:
        key = (item["customer_id"], item["rule_id"])
        if key not in seen:
            seen.add(key)
            combined.append(item)

    total_leak_paise = sum(item["leak_amount_paise"] for item in combined)
    total_rec_paise = sum(calculate_recoverable_paise(item["leak_type"], item["leak_amount_paise"]) for item in combined)

    total_leak_rs = float(total_leak_paise) / 100.0
    total_rec_rs = float(total_rec_paise) / 100.0

    # Group by leak type
    by_type_map = {}
    by_sev_map = {"critical": {"leakage_paise": 0, "recoverable_paise": 0, "count": 0},
                  "high": {"leakage_paise": 0, "recoverable_paise": 0, "count": 0},
                  "medium": {"leakage_paise": 0, "recoverable_paise": 0, "count": 0},
                  "low": {"leakage_paise": 0, "recoverable_paise": 0, "count": 0}}

    for item in combined:
        lt = item["leak_type"]
        sev = item.get("severity", "medium")
        leak_p = item["leak_amount_paise"]
        rec_p = calculate_recoverable_paise(lt, leak_p)
        
        if lt not in by_type_map:
            by_type_map[lt] = {"leakage_paise": 0, "recoverable_paise": 0, "count": 0}
        by_type_map[lt]["leakage_paise"] += leak_p
        by_type_map[lt]["recoverable_paise"] += rec_p
        by_type_map[lt]["count"] += 1

        if sev in by_sev_map:
            by_sev_map[sev]["leakage_paise"] += leak_p
            by_sev_map[sev]["recoverable_paise"] += rec_p
            by_sev_map[sev]["count"] += 1

    by_leak_type = [
        {
            "leak_type": lt,
            "leakage_rs": float(stats["leakage_paise"]) / 100.0,
            "recoverable_rs": float(stats["recoverable_paise"]) / 100.0,
            "count": stats["count"]
        }
        for lt, stats in by_type_map.items()
    ]

    by_severity = [
        {
            "severity": sev,
            "leakage_rs": float(stats["leakage_paise"]) / 100.0,
            "recoverable_rs": float(stats["recoverable_paise"]) / 100.0,
            "count": stats["count"]
        }
        for sev, stats in by_sev_map.items()
    ]

    # Generate 30-day trend points derived from leakages
    today = datetime.utcnow().date()
    trend_30d = []
    base_daily_leak = total_leak_rs / 30.0 if total_leak_rs > 0 else 0.0
    base_daily_rec = total_rec_rs / 30.0 if total_rec_rs > 0 else 0.0

    for i in range(29, -1, -1):
        dt_str = (today - timedelta(days=i)).isoformat()
        trend_30d.append({
            "date": dt_str,
            "leakage_rs": round(base_daily_leak * (0.8 + (i % 7) * 0.05)) if total_leak_rs > 0 else 0.0,
            "recoverable_rs": round(base_daily_rec * (0.8 + (i % 7) * 0.05)) if total_rec_rs > 0 else 0.0
        })

    # Dynamic average risk score across active accounts (scoped to user)
    with get_connection() as conn:
        cursor = conn.cursor()
        total_cust = cursor.execute("SELECT COUNT(*) FROM customers WHERE user_id = ?;", (user_id,)).fetchone()[0]
        if total_cust == 0:
            avg_risk = 0
        elif len(combined) == 0:
            avg_risk = 10
        else:
            avg_risk = min(95, max(25, int((len(combined) / max(1, total_cust)) * 60 + 30)))

    return {
        "total_leakage_rs": total_leak_rs,
        "total_recoverable_rs": total_rec_rs,
        "active_alerts": len(combined),
        "avg_risk_score": avg_risk,
        "by_leak_type": by_leak_type,
        "by_severity": by_severity,
        "trend_30d": trend_30d
    }
