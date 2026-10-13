from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc
from typing import List
from pydantic import BaseModel

from app.database import get_db
from app.auth.dependencies import RoleChecker
from app.auth.models import User
from app.spills.models import Spill
from app.impact.models import ImpactAssessment

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class RegionStatResponse(BaseModel):
    region: str
    total_spills: int
    confirmed_spills: int
    total_area_sq_km: float
    severity_breakdown: dict
    avg_ecological_sensitivity: float


class NationalStatResponse(BaseModel):
    total_spills: int
    total_area_sq_km: float
    severity_breakdown: dict
    region_breakdown: dict
    validation_breakdown: dict


class StateBreakdownRow(BaseModel):
    region: str
    incident_count: int
    confirmed_count: int
    total_area_sq_km: float
    critical_count: int
    high_count: int
    avg_ecological_sensitivity: float = 0.0
    commercial_loss_usd: float = 0.0


@router.get("/region/{region}", response_model=RegionStatResponse)
async def get_region_stats(
    region: str,
    user: User = Depends(RoleChecker(["regional_manager", "higher_authority", "coast_guard"])),
    db: AsyncSession = Depends(get_db),
):
    """Regional Manager / Higher Authority: get stats for a specific region."""
    total = await db.execute(
        select(sqlfunc.count(Spill.id)).where(Spill.region == region)
    )
    total_spills = total.scalar() or 0

    confirmed = await db.execute(
        select(sqlfunc.count(Spill.id)).where(
            Spill.region == region, Spill.validation_status == "confirmed"
        )
    )
    confirmed_spills = confirmed.scalar() or 0

    area = await db.execute(
        select(sqlfunc.coalesce(sqlfunc.sum(Spill.area_sq_km), 0.0)).where(Spill.region == region)
    )
    total_area = area.scalar() or 0.0

    sev_result = await db.execute(
        select(Spill.severity, sqlfunc.count(Spill.id))
        .where(Spill.region == region)
        .group_by(Spill.severity)
    )
    severity_breakdown = {row[0] or "unknown": row[1] for row in sev_result.all()}

    # Average ecological sensitivity from impact assessments
    eco_result = await db.execute(
        select(sqlfunc.coalesce(sqlfunc.avg(ImpactAssessment.ecological_sensitivity_score), 0.0))
        .join(Spill, ImpactAssessment.spill_id == Spill.id)
        .where(Spill.region == region)
    )
    avg_eco = round(float(eco_result.scalar() or 0.0), 1)

    return RegionStatResponse(
        region=region,
        total_spills=total_spills,
        confirmed_spills=confirmed_spills,
        total_area_sq_km=total_area,
        severity_breakdown=severity_breakdown,
        avg_ecological_sensitivity=avg_eco,
    )


@router.get("/national", response_model=NationalStatResponse)
async def get_national_stats(
    user: User = Depends(RoleChecker(["higher_authority", "regional_manager"])),
    db: AsyncSession = Depends(get_db),
):
    """Higher Authority: country-wide aggregate stats."""
    total = await db.execute(select(sqlfunc.count(Spill.id)))
    total_spills = total.scalar() or 0

    area = await db.execute(
        select(sqlfunc.coalesce(sqlfunc.sum(Spill.area_sq_km), 0.0))
    )
    total_area = area.scalar() or 0.0

    sev_result = await db.execute(
        select(Spill.severity, sqlfunc.count(Spill.id)).group_by(Spill.severity)
    )
    severity_breakdown = {row[0] or "unknown": row[1] for row in sev_result.all()}

    region_result = await db.execute(
        select(Spill.region, sqlfunc.count(Spill.id)).group_by(Spill.region)
    )
    region_breakdown = {row[0] or "unknown": row[1] for row in region_result.all()}

    val_result = await db.execute(
        select(Spill.validation_status, sqlfunc.count(Spill.id)).group_by(Spill.validation_status)
    )
    validation_breakdown = {row[0] or "unknown": row[1] for row in val_result.all()}

    return NationalStatResponse(
        total_spills=total_spills,
        total_area_sq_km=total_area,
        severity_breakdown=severity_breakdown,
        region_breakdown=region_breakdown,
        validation_breakdown=validation_breakdown,
    )


@router.get("/states", response_model=List[StateBreakdownRow])
async def get_state_breakdown(
    user: User = Depends(RoleChecker(["higher_authority", "regional_manager", "coast_guard"])),
    db: AsyncSession = Depends(get_db),
):
    """Higher Authority / Regional Manager: per-state/coast breakdown for drill-down."""
    result = await db.execute(
        select(
            Spill.region,
            sqlfunc.count(Spill.id).label("incident_count"),
            sqlfunc.count(Spill.id).filter(Spill.validation_status == "confirmed").label("confirmed_count"),
            sqlfunc.coalesce(sqlfunc.sum(Spill.area_sq_km), 0.0).label("total_area"),
            sqlfunc.count(Spill.id).filter(Spill.severity == "critical").label("critical_count"),
            sqlfunc.count(Spill.id).filter(Spill.severity == "high").label("high_count"),
        )
        .group_by(Spill.region)
        .order_by(sqlfunc.count(Spill.id).desc())
    )
    rows = result.all()

    # Pre-fetch avg eco sensitivity and commercial loss per region
    eco_q = await db.execute(
        select(
            Spill.region,
            sqlfunc.coalesce(sqlfunc.avg(ImpactAssessment.ecological_sensitivity_score), 0.0),
            sqlfunc.coalesce(sqlfunc.sum(ImpactAssessment.commercial_loss_usd), 0.0),
        )
        .join(Spill, ImpactAssessment.spill_id == Spill.id)
        .group_by(Spill.region)
    )
    eco_map = {r[0]: (float(r[1]), float(r[2])) for r in eco_q.all()}

    return [
        StateBreakdownRow(
            region=row.region or "Unknown",
            incident_count=row.incident_count,
            confirmed_count=row.confirmed_count,
            total_area_sq_km=round(float(row.total_area), 2),
            critical_count=row.critical_count,
            high_count=row.high_count,
            avg_ecological_sensitivity=round(eco_map.get(row.region, (0.0, 0.0))[0], 1),
            commercial_loss_usd=round(eco_map.get(row.region, (0.0, 0.0))[1], 2),
        )
        for row in rows
    ]
