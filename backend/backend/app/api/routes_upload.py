from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.models.schemas import DataUploadResponse
from app.services.data_ingestion import parse_and_ingest_file
from app.services.auth_service import get_current_user
from app.services.sendgrid_service import send_alert_email_async
from app.db.connection import get_connection

router = APIRouter()

@router.post("/api/upload", response_model=DataUploadResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Accepts user dataset uploads in formats: .csv, .xlsx, .xls, .json, .zip.
    Ingests records into the unified SQLite database and refreshes the process twin engine.
    Data is scoped to the authenticated user.
    """
    user_id = current_user.get("sub", "system")
    user_email = current_user.get("email", "")
    filename = file.filename or "uploaded_dataset.csv"
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        
        result = parse_and_ingest_file(content, filename, user_id=user_id)

        # Retrieve generated alerts and dispatch SendGrid real-time notification if configured
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                rows = cursor.execute("""
                    SELECT a.*, c.name as customer_name
                    FROM alerts a
                    LEFT JOIN customers c ON a.customer_id = c.customer_id AND c.user_id = a.user_id
                    WHERE a.user_id = ? AND a.severity IN ('critical', 'high')
                    ORDER BY a.created_at DESC
                """, (user_id,)).fetchall()
                alerts_list = [dict(r) for r in rows]
                if alerts_list:
                    send_alert_email_async(user_email, alerts_list)
        except Exception as email_err:
            print(f"SendGrid trigger warning: {email_err}")

        return result
    except HTTPException as he:
        raise he
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data ingestion failed: {str(e)}")
