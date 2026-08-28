from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.models.schemas import DataUploadResponse
from app.services.data_ingestion import parse_and_ingest_file
from app.services.auth_service import get_current_user

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
    filename = file.filename or "uploaded_dataset.csv"
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        
        result = parse_and_ingest_file(content, filename, user_id=user_id)
        return result
    except HTTPException as he:
        raise he
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data ingestion failed: {str(e)}")

