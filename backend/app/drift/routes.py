from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.drift.models import DriftSimulation
from app.drift.schemas import DriftSimulationResponse
from app.drift.simulation import simulate_drift, get_file_version_hash
from app.spills.models import Spill

router = APIRouter(prefix="/api/drift", tags=["drift"])

# In-memory cache for drift simulations: key -> response dict
_DRIFT_CACHE = {}


def _get_cache_key(spill_id: int, direction: str, duration_hours: int) -> str:
    version_hash = get_file_version_hash()
    return f"{spill_id}_{direction}_{duration_hours}_{version_hash}"


async def get_or_run_drift(spill_id: int, direction: str, duration_hours: int, db: AsyncSession) -> dict:
    """Fetch cached, DB, or dynamically computed RK4 drift simulation."""
    cache_key = _get_cache_key(spill_id, direction, duration_hours)
    if cache_key in _DRIFT_CACHE:
        return _DRIFT_CACHE[cache_key]

    result = await db.execute(
        select(DriftSimulation)
        .where(DriftSimulation.spill_id == spill_id, DriftSimulation.direction == direction)
        .order_by(DriftSimulation.created_at.desc())
    )
    drift = result.scalar_one_or_none()

    # Check if DB drift already has RK4 with forcing_timeline
    if drift and drift.parameters and drift.parameters.get("method", "").startswith("rk4") and drift.parameters.get("forcing_timeline"):
        pts = drift.trajectory_points or []
        resp_data = {
            "id": drift.id,
            "spill_id": drift.spill_id,
            "direction": drift.direction,
            "sim_start_time": drift.sim_start_time,
            "sim_end_time": drift.sim_end_time,
            "duration_hours": drift.duration_hours,
            "origin_cone_geojson": drift.parameters.get("cone_geojson"),
            "contour_50_geojson": drift.parameters.get("contour_50_geojson"),
            "contour_90_geojson": drift.parameters.get("contour_90_geojson"),
            "origin_heatmap_geojson": drift.parameters.get("origin_heatmap_geojson"),
            "predicted_path_geojson": drift.parameters.get("predicted_path_geojson"),
            "trajectory_points": pts,
            "parameters": drift.parameters,
            "forcing_timeline": drift.parameters.get("forcing_timeline", []),
            "data_provenance": drift.parameters.get("data_provenance", "seeded_demo"),
            "created_at": drift.created_at,
        }
        _DRIFT_CACHE[cache_key] = resp_data
        return resp_data

    # Load spill coordinates and compute fresh RK4 simulation
    spill_res = await db.execute(select(Spill).where(Spill.id == spill_id))
    spill = spill_res.scalar_one_or_none()
    if not spill:
        raise HTTPException(status_code=404, detail="Spill not found")

    lat = spill.centroid_lat or 18.85
    lon = spill.centroid_lon or 71.90
    t0 = spill.detected_at or datetime.now(timezone.utc)

    sim = simulate_drift(
        spill_lat=lat,
        spill_lon=lon,
        spill_time=t0,
        direction=direction,
        duration_hours=duration_hours,
        num_particles=200,
        random_seed=42 if direction == "backward" else 1,
    )

    pred_path = None
    if direction == "forward" and sim.get("trajectory_points"):
        pred_path = {
            "type": "LineString",
            "coordinates": [[p["lon"], p["lat"]] for p in sim["trajectory_points"] if "lon" in p]
        }

    sim["parameters"]["cone_geojson"] = sim.get("cone_geojson")
    sim["parameters"]["contour_50_geojson"] = sim.get("contour_50_geojson")
    sim["parameters"]["contour_90_geojson"] = sim.get("contour_90_geojson")
    sim["parameters"]["origin_heatmap_geojson"] = sim.get("origin_heatmap")
    sim["parameters"]["predicted_path_geojson"] = pred_path

    # Persist or update in DB
    if not drift:
        drift = DriftSimulation(
            spill_id=spill.id,
            direction=direction,
            sim_start_time=datetime.fromisoformat(sim["sim_start_time"]),
            sim_end_time=datetime.fromisoformat(sim["sim_end_time"]),
            duration_hours=duration_hours,
            trajectory_points=sim["trajectory_points"],
            parameters=sim["parameters"],
        )
        db.add(drift)
    else:
        drift.duration_hours = duration_hours
        drift.trajectory_points = sim["trajectory_points"]
        drift.parameters = sim["parameters"]
    await db.commit()
    await db.refresh(drift)

    resp_data = {
        "id": drift.id,
        "spill_id": drift.spill_id,
        "direction": drift.direction,
        "sim_start_time": drift.sim_start_time,
        "sim_end_time": drift.sim_end_time,
        "duration_hours": drift.duration_hours,
        "origin_cone_geojson": sim.get("cone_geojson"),
        "contour_50_geojson": sim.get("contour_50_geojson"),
        "contour_90_geojson": sim.get("contour_90_geojson"),
        "origin_heatmap_geojson": sim.get("origin_heatmap"),
        "predicted_path_geojson": pred_path,
        "trajectory_points": sim["trajectory_points"],
        "parameters": sim["parameters"],
        "forcing_timeline": sim["parameters"].get("forcing_timeline", []),
        "data_provenance": sim.get("data_provenance", "seeded_demo"),
        "created_at": drift.created_at,
    }
    _DRIFT_CACHE[cache_key] = resp_data
    return resp_data


@router.get("/{spill_id}/backward", response_model=DriftSimulationResponse)
async def get_backward_drift(
    spill_id: int,
    duration_hours: int = Query(24, ge=1, le=72),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get backward drift simulation result — RK4 probability cone & 50%/90% contours."""
    data = await get_or_run_drift(spill_id, "backward", duration_hours, db)
    return DriftSimulationResponse(**data)


@router.get("/{spill_id}/forward", response_model=DriftSimulationResponse)
async def get_forward_drift(
    spill_id: int,
    duration_hours: int = Query(48, ge=1, le=120),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get forward drift simulation result — predicted future trajectory."""
    data = await get_or_run_drift(spill_id, "forward", duration_hours, db)
    return DriftSimulationResponse(**data)


@router.post("/{spill_id}/whatif", response_model=DriftSimulationResponse)
async def whatif_drift(
    spill_id: int,
    payload: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run non-persisted hypothetical drift simulation with operator-supplied current/wind."""
    spill_res = await db.execute(select(Spill).where(Spill.id == spill_id))
    spill = spill_res.scalar_one_or_none()
    if not spill:
        raise HTTPException(status_code=404, detail="Spill not found")

    lat = spill.centroid_lat or 18.85
    lon = spill.centroid_lon or 71.90
    t0 = spill.detected_at or datetime.now(timezone.utc)
    dur = int(payload.get("duration_hours", 24))
    direction = payload.get("direction", "backward")

    overrides = {
        "current_speed_ms": float(payload.get("current_speed_ms", 0.25)),
        "current_dir_deg": float(payload.get("current_dir_deg", 215.0)),
        "wind_speed_ms": float(payload.get("wind_speed_ms", 5.5)),
        "wind_dir_deg": float(payload.get("wind_dir_deg", 205.0)),
    }

    sim = simulate_drift(
        spill_lat=lat,
        spill_lon=lon,
        spill_time=t0,
        direction=direction,
        duration_hours=dur,
        num_particles=150,
        overrides=overrides,
        random_seed=1,
    )
    sim["parameters"]["persisted"] = False

    pred_path = None
    if direction == "forward" and sim.get("trajectory_points"):
        pred_path = {
            "type": "LineString",
            "coordinates": [[p["lon"], p["lat"]] for p in sim["trajectory_points"] if "lon" in p]
        }

    return DriftSimulationResponse(
        id=0,
        spill_id=spill.id,
        direction=direction,
        sim_start_time=datetime.fromisoformat(sim["sim_start_time"]),
        sim_end_time=datetime.fromisoformat(sim["sim_end_time"]),
        duration_hours=dur,
        origin_cone_geojson=sim.get("cone_geojson"),
        contour_50_geojson=sim.get("contour_50_geojson"),
        contour_90_geojson=sim.get("contour_90_geojson"),
        origin_heatmap_geojson=sim.get("origin_heatmap"),
        predicted_path_geojson=pred_path,
        trajectory_points=sim["trajectory_points"],
        parameters=sim["parameters"],
        forcing_timeline=sim["parameters"].get("forcing_timeline", []),
        data_provenance=sim.get("data_provenance", "seeded_demo"),
        created_at=datetime.now(timezone.utc),
    )


@router.get("/{spill_id}/all", response_model=List[DriftSimulationResponse])
async def get_all_drift(
    spill_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all drift simulations for a spill."""
    back = await get_or_run_drift(spill_id, "backward", 24, db)
    fwd = await get_or_run_drift(spill_id, "forward", 48, db)
    return [DriftSimulationResponse(**back), DriftSimulationResponse(**fwd)]

