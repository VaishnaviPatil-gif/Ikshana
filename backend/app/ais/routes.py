from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import RoleChecker
from app.auth.models import User
from app.ais.client import ais_client

router = APIRouter(prefix="/api/ais", tags=["ais"])

@router.get("/status")
async def get_ais_status(user: User = Depends(RoleChecker(["coast_guard", "regional_manager", "higher_authority"]))):
    return {
        "running": ais_client.running,
        "connected": ais_client.connected,
        "api_key_configured": bool(ais_client.api_key)
    }

@router.post("/start")
async def start_ais(user: User = Depends(RoleChecker(["higher_authority"]))):
    if not ais_client.api_key:
        raise HTTPException(status_code=400, detail="AISStream API key not configured")
    if ais_client.running:
        return {"status": "already_running"}
    ais_client.start()
    return {"status": "started"}

@router.post("/stop")
async def stop_ais(user: User = Depends(RoleChecker(["higher_authority"]))):
    if not ais_client.running:
        return {"status": "already_stopped"}
    ais_client.stop()
    return {"status": "stopped"}
