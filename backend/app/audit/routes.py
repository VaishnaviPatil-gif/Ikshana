from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.auth.dependencies import RoleChecker
from app.auth.models import User
from app.audit.models import AuditLog

router = APIRouter(prefix="/api/audit", tags=["audit"])

@router.get("/logs")
async def get_audit_logs(
    user: User = Depends(RoleChecker(["higher_authority"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100))
    logs = result.scalars().all()
    return [{"id": l.id, "user_id": l.user_id, "action": l.action, "resource_type": l.resource_type, "resource_id": l.resource_id, "details": l.details, "ip_address": l.ip_address, "timestamp": l.timestamp} for l in logs]

@router.get("/logs/{resource_id}")
async def get_resource_audit_logs(
    resource_id: str,
    user: User = Depends(RoleChecker(["higher_authority", "regional_manager", "coast_guard"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AuditLog).where(AuditLog.resource_id == resource_id).order_by(AuditLog.timestamp.desc()))
    logs = result.scalars().all()
    return [{"id": l.id, "user_id": l.user_id, "action": l.action, "resource_type": l.resource_type, "resource_id": l.resource_id, "details": l.details, "ip_address": l.ip_address, "timestamp": l.timestamp} for l in logs]
