import json
from sqlalchemy.ext.asyncio import AsyncSession
from app.audit.models import AuditLog

async def log_action(db: AsyncSession, user_id: int, action: str, resource_type: str, resource_id: str, details: dict, ip: str = None):
    try:
        log_entry = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details_json=json.dumps(details) if details else None,
            ip_address=ip
        )
        db.add(log_entry)
        await db.flush()
    except Exception as e:
        print(f"[WARN] Failed to write audit log: {e}")
