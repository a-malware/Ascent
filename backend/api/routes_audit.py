from fastapi import APIRouter
from modules import audit

router = APIRouter()

@router.get("/audit")
async def get_audit_logs(limit: int = 50):
    return {"logs": audit.get_logs(limit)}
