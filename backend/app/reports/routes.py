import re
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth.dependencies import RoleChecker
from app.auth.models import User
from app.spills.models import Spill
from app.impact.models import ImpactAssessment
from app.attribution.models import SuspectScore
from app.vessels.models import Vessel

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/dossier/{spill_id}")
async def generate_pdf_report(
    spill_id: int,
    user: User = Depends(RoleChecker(["coast_guard", "regional_manager", "higher_authority"])),
    db: AsyncSession = Depends(get_db),
):
    """Generate PDF evidence report for a spill. Role-scoped content."""
    # Fetch spill
    spill_result = await db.execute(select(Spill).where(Spill.id == spill_id))
    spill = spill_result.scalar_one_or_none()
    if not spill:
        raise HTTPException(status_code=404, detail="Spill not found")

    # Fetch impact
    impact_result = await db.execute(
        select(ImpactAssessment).where(ImpactAssessment.spill_id == spill_id)
    )
    impact = impact_result.scalar_one_or_none()

    # Fetch suspects (only for authenticated roles)
    suspects = []
    try:
        suspects_result = await db.execute(
            select(SuspectScore, Vessel)
            .join(Vessel, SuspectScore.vessel_id == Vessel.id)
            .where(SuspectScore.spill_id == spill_id)
            .order_by(SuspectScore.rank)
            .limit(5)
        )
        suspects = suspects_result.all()
    except Exception as err:
        print(f"[WARN] Failed to query suspects for report: {err}")

    qualcomm_brief = None
    try:
        from app.qualcomm.service import _load_cache
        cached_ai = _load_cache(str(spill_id))
        if cached_ai and cached_ai.get("explanation"):
            qualcomm_brief = cached_ai.get("explanation")
    except Exception as err:
        print(f"[WARN] Failed to load Qualcomm brief for report: {err}")

    from app.reports.generator import build_evidence_pdf
    try:
        pdf_bytes = build_evidence_pdf(
            spill=spill,
            impact=impact,
            suspects=suspects,
            user_role=user.role,
            qualcomm_brief=qualcomm_brief,
        )
    except Exception as err:
        print(f"[ERROR] PDF generation failed for spill {spill_id}: {err}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(err)}")

    clean_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', str(spill.name or f'SPILL-{spill_id}'))
    filename = f"SARVAS-Forensic-Report-{clean_name}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
