"""
GIS & Data Health API Routes.
Serves:
  - India EEZ (Mainland + Andaman & Nicobar, Bassas da India excluded)
  - Coral Reefs with spatial bounding-box filtering (prevents 12.8MB load lag)
  - Data Health Stream freshness status (SAR, ERA5, CMEMS, AIS)
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import json
from pathlib import Path
from datetime import datetime, timezone
import xarray as xr

router = APIRouter(prefix="/api/gis", tags=["gis"])

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
EEZ_PATH = DATA_DIR / "gis" / "eez" / "india_eez.geojson"
CORALS_PATH = DATA_DIR / "gis" / "corals" / "coral_reefs.geojson"
ERA5_PATH = DATA_DIR / "era5" / "era5_wind_india.nc"
CMEMS_PATH = DATA_DIR / "cmems" / "currents_india.nc"
CMEMS_SYNTH_PATH = DATA_DIR / "cmems" / "currents_india_synthetic.nc"

_CACHED_CORALS = None


def _load_corals():
    global _CACHED_CORALS
    if _CACHED_CORALS is None and CORALS_PATH.exists():
        try:
            with open(CORALS_PATH, "r", encoding="utf-8") as f:
                _CACHED_CORALS = json.load(f)
        except Exception as e:
            print(f"[WARN] Could not load coral reefs: {e}")
            _CACHED_CORALS = {"type": "FeatureCollection", "features": []}
    return _CACHED_CORALS or {"type": "FeatureCollection", "features": []}


@router.get("/eez")
async def get_eez_layer():
    """Return India EEZ GeoJSON (Bassas da India excluded)."""
    if not EEZ_PATH.exists():
        raise HTTPException(status_code=404, detail="EEZ GeoJSON not found")
    with open(EEZ_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Ensure Bassas da India is excluded
    clean_feats = [
        f for f in data.get("features", [])
        if "Bassas da India" not in f.get("properties", {}).get("GEONAME", "")
    ]
    return {"type": "FeatureCollection", "features": clean_feats}


@router.get("/corals")
async def get_coral_reefs(
    min_lon: Optional[float] = Query(None),
    min_lat: Optional[float] = Query(None),
    max_lon: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None),
    limit: int = Query(500, le=2000)
):
    """
    Return coral reef features with spatial bbox filtering.
    Prevents loading the raw 12.8MB file in the frontend.
    """
    corals = _load_corals()
    features = corals.get("features", [])

    if min_lon is None or min_lat is None or max_lon is None or max_lat is None:
        # If no bbox provided, return sampled subset
        return {
            "type": "FeatureCollection",
            "features": features[:limit],
            "total_matched": len(features),
            "sampled": True
        }

    matched = []
    for f in features:
        geom = f.get("geometry")
        if not geom:
            continue
        coords = geom.get("coordinates", [])
        if geom.get("type") == "Polygon" and coords:
            # Check bounding box of first ring
            ring = coords[0]
            if any(min_lon <= pt[0] <= max_lon and min_lat <= pt[1] <= max_lat for pt in ring):
                matched.append(f)
                if len(matched) >= limit:
                    break
        elif geom.get("type") == "MultiPolygon" and coords:
            # Check bounding box of polygons
            found = False
            for poly in coords:
                if poly and any(min_lon <= pt[0] <= max_lon and min_lat <= pt[1] <= max_lat for pt in poly[0]):
                    matched.append(f)
                    found = True
                    break
            if found and len(matched) >= limit:
                break

    return {
        "type": "FeatureCollection",
        "features": matched,
        "total_matched": len(matched),
        "sampled": False
    }


@router.get("/data-streams")
async def get_data_streams_health():
    """Return live freshness and operational status for all input data streams."""
    from app.config import settings
    streams = {}

    # 1. SAR Scenes
    sar_upload_dir = DATA_DIR / "sar" / "uploads"
    sar_demo_dir = DATA_DIR / "sar" / "demo_for_judges"
    latest_sar_time = None
    sar_count = 0
    for d in (sar_upload_dir, sar_demo_dir):
        if d.exists():
            for p in d.glob("*.*"):
                if p.suffix.lower() in (".tif", ".tiff", ".png", ".jpg"):
                    sar_count += 1
                    mtime = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc)
                    if latest_sar_time is None or mtime > latest_sar_time:
                        latest_sar_time = mtime
    streams["sar"] = {
        "name": "Sentinel-1 SAR",
        "status": "active" if sar_count > 0 else "missing",
        "last_update": latest_sar_time.isoformat() if latest_sar_time else None,
        "details": f"{sar_count} scenes indexed (Sentinel-1 C-SAR IW GRD)",
        "provenance": "real",
    }

    # 2. ERA5 Wind
    if ERA5_PATH.exists():
        try:
            with xr.open_dataset(ERA5_PATH) as ds:
                t = ds["valid_time"].values
                t_start = str(t[0])[:19]
                t_end = str(t[-1])[:19]
            streams["era5"] = {
                "name": "ECMWF ERA5 Wind",
                "status": "active",
                "coverage_start": t_start,
                "coverage_end": t_end,
                "details": f"10m u/v vectors ({t_start} to {t_end})",
                "provenance": "real",
            }
        except Exception as e:
            streams["era5"] = {"name": "ECMWF ERA5 Wind", "status": "error", "details": str(e), "provenance": "unavailable"}
    else:
        streams["era5"] = {"name": "ECMWF ERA5 Wind", "status": "missing", "details": "era5_wind_india.nc not found", "provenance": "unavailable"}

    # 3. Ocean Currents (CMEMS)
    if CMEMS_PATH.exists():
        try:
            with xr.open_dataset(CMEMS_PATH) as ds:
                t = ds["time"].values
                t_start = str(t[0])[:19]
                t_end = str(t[-1])[:19]
            streams["currents"] = {
                "name": "CMEMS Surface Currents",
                "status": "active",
                "coverage_start": t_start,
                "coverage_end": t_end,
                "details": f"Global Analysis PHY uo/vo ({t_start} to {t_end})",
                "provenance": "real",
            }
        except Exception as e:
            streams["currents"] = {"name": "CMEMS Surface Currents", "status": "error", "details": str(e), "provenance": "unavailable"}
    elif CMEMS_SYNTH_PATH.exists():
        streams["currents"] = {
            "name": "CMEMS Surface Currents",
            "status": "demo_synthetic",
            "details": "SYNTHETIC currents_india_synthetic.nc (Demonstration only)",
            "provenance": "seeded_demo",
        }
    else:
        streams["currents"] = {
            "name": "CMEMS Surface Currents",
            "status": "missing",
            "details": "Currents file missing (operating in Wind-only drift mode)",
            "provenance": "unavailable",
        }

    # 4. AIS Stream
    ais_live = bool(settings.AISSTREAM_API_KEY)
    streams["ais"] = {
        "name": "AIS Telemetry",
        "status": "live" if ais_live else "archive",
        "mode": "Live AISStream WebSocket" if ais_live else "Historical DB Tracks",
        "provenance": "real_live_ais" if ais_live else "seeded_demo",
        "details": "Real-time coastal & high-seas fixes" if ais_live else "Archived and demo verified transponder feeds",
    }

    return streams
