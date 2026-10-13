from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc
from typing import Optional, List
import io
import os
from datetime import datetime, timezone
import pandas as pd

from app.database import get_db
from app.auth.dependencies import RoleChecker
from app.auth.models import User
from app.vessels.models import Vessel, AISTrack
from app.vessels.schemas import (
    VesselResponse, VesselTrackResponse, AISTrackPoint, VesselClassificationRow
)

router = APIRouter(prefix="/api/vessels", tags=["vessels"])


@router.get("", response_model=List[VesselResponse])
async def list_vessels(
    vessel_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    user: User = Depends(RoleChecker(["coast_guard", "regional_manager", "higher_authority"])),
    db: AsyncSession = Depends(get_db),
):
    """List vessels, optionally filtered by type."""
    query = select(Vessel).order_by(Vessel.vessel_name).limit(limit)
    if vessel_type:
        query = query.where(Vessel.vessel_type == vessel_type)
    result = await db.execute(query)
    vessels = result.scalars().all()
    return [VesselResponse.model_validate(v) for v in vessels]


@router.get("/classification", response_model=List[VesselClassificationRow])
async def vessel_classification(
    user: User = Depends(RoleChecker(["regional_manager", "higher_authority"])),
    db: AsyncSession = Depends(get_db),
):
    """Vessel type classification table for Regional Manager (DB-agnostic)."""
    query = (
        select(
            Vessel.vessel_type,
            sqlfunc.count(Vessel.id).label("count"),
        )
        .group_by(Vessel.vessel_type)
        .order_by(sqlfunc.count(Vessel.id).desc())
    )
    result = await db.execute(query)
    rows = result.all()

    vessels_res = await db.execute(select(Vessel.vessel_type, Vessel.vessel_name))
    all_v = vessels_res.all()
    type_names = {}
    for vt, vn in all_v:
        k = vt or "Unknown"
        if vn:
            type_names.setdefault(k, []).append(vn)

    return [
        VesselClassificationRow(
            vessel_type=row.vessel_type or "Unknown",
            count=row.count,
            vessel_names=type_names.get(row.vessel_type or "Unknown", []),
        )
        for row in rows
    ]


@router.get("/{vessel_id}", response_model=VesselResponse)
async def get_vessel(
    vessel_id: int,
    user: User = Depends(RoleChecker(["coast_guard", "regional_manager", "higher_authority"])),
    db: AsyncSession = Depends(get_db),
):
    """Get a single vessel by ID."""
    result = await db.execute(select(Vessel).where(Vessel.id == vessel_id))
    vessel = result.scalar_one_or_none()
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not found")
    return VesselResponse.model_validate(vessel)


@router.get("/{vessel_id}/tracks", response_model=VesselTrackResponse)
async def get_vessel_tracks(
    vessel_id: int,
    limit: int = Query(500, le=5000),
    user: User = Depends(RoleChecker(["coast_guard"])),
    db: AsyncSession = Depends(get_db),
):
    """Get AIS track points for a vessel — for ship animation (Coast Guard only)."""
    result = await db.execute(select(Vessel).where(Vessel.id == vessel_id))
    vessel = result.scalar_one_or_none()
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not found")

    tracks_result = await db.execute(
        select(AISTrack)
        .where(AISTrack.vessel_id == vessel_id)
        .order_by(AISTrack.base_datetime)
        .limit(limit)
    )
    tracks = tracks_result.scalars().all()

    track_points = [
        AISTrackPoint(
            timestamp=t.base_datetime,
            lat=t.lat,
            lon=t.lon,
            sog=t.sog,
            cog=t.cog,
            heading=t.heading,
            nav_status=t.nav_status,
        )
        for t in tracks
    ]

    return VesselTrackResponse(
        vessel=VesselResponse.model_validate(vessel),
        track=track_points,
        total_points=len(track_points),
    )


@router.post("/upload-ais")
async def upload_ais_csv(
    file: UploadFile = File(...),
    user: User = Depends(RoleChecker(["coast_guard", "regional_manager", "higher_authority"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload real AIS CSV dataset.
    Supports columns: MMSI, BaseDateTime/Timestamp, LAT, LON, SOG, COG, VesselName, VesselType
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported for AIS data.")

    # Save copy to data/ais
    ais_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "ais")
    os.makedirs(ais_dir, exist_ok=True)
    saved_path = os.path.join(ais_dir, file.filename)

    contents = await file.read()
    with open(saved_path, "wb") as f:
        f.write(contents)

    # Parse CSV with pandas
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")

    col_map = {c: c.strip().lower() for c in df.columns}
    df.rename(columns=col_map, inplace=True)

    mmsi_col = next((c for c in df.columns if "mmsi" in c), None)
    time_col = next((c for c in df.columns if any(t in c for t in ["time", "date"])), None)
    lat_col = next((c for c in df.columns if "lat" in c), None)
    lon_col = next((c for c in df.columns if any(t in c for t in ["lon", "lng"])), None)
    sog_col = next((c for c in df.columns if any(t in c for t in ["sog", "speed"])), None)
    cog_col = next((c for c in df.columns if any(t in c for t in ["cog", "course"])), None)
    name_col = next((c for c in df.columns if any(t in c for t in ["vessel", "name", "ship"])), None)
    type_col = next((c for c in df.columns if "type" in c), None)

    if not (mmsi_col and time_col and lat_col and lon_col):
        raise HTTPException(
            status_code=400,
            detail=f"CSV missing mandatory columns (MMSI, Timestamp, Latitude, Longitude). Found: {list(df.columns)}"
        )

    unique_mmsis = df[mmsi_col].dropna().unique()
    vessel_map = {}
    new_vessels = 0

    for raw_mmsi in unique_mmsis:
        mmsi_str = str(int(raw_mmsi) if isinstance(raw_mmsi, (int, float)) else raw_mmsi).strip()
        res = await db.execute(select(Vessel).where(Vessel.mmsi == mmsi_str))
        v = res.scalar_one_or_none()
        if not v:
            v_name = None
            v_type = "Tanker"
            if name_col:
                v_row = df[df[mmsi_col] == raw_mmsi].iloc[0]
                v_name = str(v_row[name_col]) if pd.notna(v_row[name_col]) else None
                if type_col and pd.notna(v_row[type_col]):
                    v_type = str(v_row[type_col])

            v = Vessel(
                mmsi=mmsi_str,
                vessel_name=v_name or f"VESSEL-{mmsi_str}",
                vessel_type=v_type,
                flag_state="India"
            )
            db.add(v)
            await db.flush()
            await db.refresh(v)
            new_vessels += 1
        vessel_map[mmsi_str] = v.id

    track_count = 0
    for _, row in df.iterrows():
        mmsi_str = str(int(row[mmsi_col]) if isinstance(row[mmsi_col], (int, float)) else row[mmsi_col]).strip()
        v_id = vessel_map.get(mmsi_str)
        if not v_id:
            continue

        try:
            ts = pd.to_datetime(row[time_col]).to_pydatetime()
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        except Exception:
            continue

        lat = float(row[lat_col])
        lon = float(row[lon_col])
        sog = float(row[sog_col]) if sog_col and pd.notna(row[sog_col]) else 12.0
        cog = float(row[cog_col]) if cog_col and pd.notna(row[cog_col]) else 0.0

        track = AISTrack(
            vessel_id=v_id,
            base_datetime=ts,
            lat=round(lat, 6),
            lon=round(lon, 6),
            sog=round(max(0.0, sog), 1),
            cog=round(cog % 360, 1),
            heading=round(cog % 360, 1),
            nav_status="Under way using engine"
        )
        db.add(track)
        track_count += 1
        if track_count % 500 == 0:
            await db.flush()

    await db.commit()

    return {
        "status": "success",
        "message": f"Successfully ingested {len(unique_mmsis)} vessels ({new_vessels} new) and {track_count} AIS track points.",
        "unique_vessels": len(unique_mmsis),
        "new_vessels": new_vessels,
        "track_points": track_count,
        "filename": file.filename
    }

