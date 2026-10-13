"""
Drift simulation module — 4th-order Runge-Kutta (RK4) Lagrangian particle advection.
Produces backward (origin probability cone & contours) and forward (predicted trajectory)
using authentic CMEMS currents & ERA5 wind when covered, synthetic data when dated for demo,
and honest fallback when outside coverage window.

Features:
- RK4 integration with random walk turbulent diffusion
- Coastline LineString segment collision detection (particles stop at land)
- 50% and 90% probability contours extracted via KDE of particle positions
- Honest temporal coverage check: flags 'No real forcing data for this date'
- Lazy NetCDF caching to avoid disk re-opens
- Origin heatmap and forcing timeline outputs
"""
import os
import json
import math
import hashlib
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple

import numpy as np
from scipy.stats import gaussian_kde
import cv2
from shapely.geometry import Point, MultiPoint, Polygon, MultiPolygon, LineString, MultiLineString, shape, box
from shapely.prepared import prep
from shapely.ops import unary_union

# Paths to data
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CMEMS_PATH = _DATA_DIR / "cmems" / "currents_india.nc"
CMEMS_SYNTH_PATH = _DATA_DIR / "cmems" / "currents_india_synthetic.nc"
CMEMS_SYNTHETIC_PATH = CMEMS_SYNTH_PATH
ERA5_PATH = _DATA_DIR / "era5" / "era5_wind_india.nc"
COASTLINE_PATH = _DATA_DIR / "gis" / "coastline" / "india_coastline.geojson"

# Module-level lazy cache for datasets and coastline
_DATASET_CACHE = {}
_COASTLINE_PREP = None
_COASTLINE_MLS = None


def _get_dataset(path: Path):
    """Lazy loader for xarray NetCDF datasets."""
    p_str = str(path)
    if p_str not in _DATASET_CACHE:
        if path.exists():
            try:
                import xarray as xr
                _DATASET_CACHE[p_str] = xr.open_dataset(path)
            except Exception as e:
                print(f"[WARN] Failed to open NetCDF {path.name}: {e}")
                _DATASET_CACHE[p_str] = None
        else:
            _DATASET_CACHE[p_str] = None
    return _DATASET_CACHE.get(p_str)


def _get_coastline():
    """Load and prepare coastline LineStrings for collision detection."""
    global _COASTLINE_PREP, _COASTLINE_MLS
    if _COASTLINE_PREP is None:
        if COASTLINE_PATH.exists():
            try:
                with open(COASTLINE_PATH, "r", encoding="utf-8") as f:
                    gj = json.load(f)
                lines = [shape(feat["geometry"]) for feat in gj.get("features", []) if feat.get("geometry")]
                if lines:
                    _COASTLINE_MLS = MultiLineString(lines)
                    _COASTLINE_PREP = prep(_COASTLINE_MLS)
            except Exception as e:
                print(f"[WARN] Failed to load coastline geometry: {e}")
    return _COASTLINE_PREP, _COASTLINE_MLS


def get_file_version_hash() -> str:
    """Return an aggregate version hash of the forcing files for cache invalidation."""
    hasher = hashlib.md5()
    for p in (ERA5_PATH, CMEMS_PATH, CMEMS_SYNTH_PATH):
        if p.exists():
            st = p.stat()
            hasher.update(f"{p.name}_{st.st_mtime}_{st.st_size}".encode("utf-8"))
    return hasher.hexdigest()[:12]


def check_forcing_coverage(dt: datetime) -> Dict[str, Any]:
    """
    Check if datetime is covered by real ERA5 or real CMEMS.
    Returns availability status, provenance, and source descriptions.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    # 1. Check ERA5 wind
    ds_era5 = _get_dataset(ERA5_PATH)
    era5_covered = False
    era5_source = "No real forcing data for this date"
    if ds_era5 is not None:
        try:
            t_var = "valid_time" if "valid_time" in ds_era5.coords else "time"
            times = ds_era5[t_var].values
            t_min = np.datetime64(str(dt.isoformat())[:19])
            if times[0] <= t_min <= times[-1]:
                era5_covered = True
                era5_source = "ECMWF ERA5 10m Reanalysis (real)"
        except Exception:
            pass

    # 2. Check CMEMS currents
    ds_cmems = _get_dataset(CMEMS_PATH)
    cmems_covered = False
    cmems_source = "No real forcing data for this date"
    cmems_provenance = "unavailable"

    if ds_cmems is not None:
        try:
            times = ds_cmems["time"].values
            t_min = np.datetime64(str(dt.isoformat())[:19])
            if times[0] <= t_min <= times[-1]:
                cmems_covered = True
                cmems_source = "Copernicus CMEMS Global PHY (real)"
                cmems_provenance = "real"
        except Exception:
            pass

    # Check synthetic fallback if real not covered
    if not cmems_covered:
        ds_synth = _get_dataset(CMEMS_SYNTH_PATH)
        if ds_synth is not None:
            try:
                times = ds_synth["time"].values
                t_min = np.datetime64(str(dt.isoformat())[:19])
                if times[0] <= t_min <= times[-1]:
                    cmems_source = "CMEMS synthetic currents (Demonstration only)"
                    cmems_provenance = "seeded_demo"
            except Exception:
                pass

    overall_provenance = "real" if (era5_covered and cmems_covered) else ("seeded_demo" if cmems_provenance == "seeded_demo" else "empirical_baseline")

    return {
        "dt": dt.isoformat(),
        "era5_covered": era5_covered,
        "cmems_covered": cmems_covered,
        "wind_source": era5_source,
        "current_source": cmems_source,
        "data_provenance": overall_provenance,
        "has_real_forcing": era5_covered or cmems_covered,
    }


def sample_forcing_vector(lat: float, lon: float, dt: datetime, overrides: Optional[dict] = None) -> Tuple[float, float, float, float, str, str, str]:
    """
    Sample current velocity (u, v) and wind velocity (u10, v10) at lat, lon, dt.
    Returns: (current_u, current_v, wind_u, wind_v, current_source, wind_source, provenance)
    """
    if overrides:
        c_speed = overrides.get("current_speed_ms", 0.0)
        c_dir = overrides.get("current_dir_deg", 0.0)
        w_speed = overrides.get("wind_speed_ms", 0.0)
        w_dir = overrides.get("wind_dir_deg", 0.0)
        c_u = c_speed * math.sin(math.radians(c_dir))
        c_v = c_speed * math.cos(math.radians(c_dir))
        w_u = w_speed * math.sin(math.radians(w_dir))
        w_v = w_speed * math.cos(math.radians(w_dir))
        return c_u, c_v, w_u, w_v, "Override constant", "Override constant", "override"

    cov = check_forcing_coverage(dt)

    # Sample currents
    c_u, c_v = 0.0, 0.0
    c_source = cov["current_source"]
    c_prov = cov["data_provenance"]

    ds_cmems = _get_dataset(CMEMS_PATH) if cov["cmems_covered"] else (_get_dataset(CMEMS_SYNTH_PATH) if cov["data_provenance"] == "seeded_demo" else None)
    if ds_cmems is not None:
        try:
            t_val = np.datetime64(str(dt.isoformat())[:19])
            ds_t = ds_cmems.sel(time=t_val, method="nearest")
            if "depth" in ds_t.coords:
                ds_t = ds_t.isel(depth=0)
            u_pt = float(ds_t["uo"].sel(latitude=lat, longitude=lon, method="nearest").values)
            v_pt = float(ds_t["vo"].sel(latitude=lat, longitude=lon, method="nearest").values)
            if not np.isnan(u_pt) and not np.isnan(v_pt):
                c_u, c_v = u_pt, v_pt
        except Exception:
            pass

    # Sample wind
    w_u, w_v = 0.0, 0.0
    w_source = cov["wind_source"]
    ds_era5 = _get_dataset(ERA5_PATH) if cov["era5_covered"] else None
    if ds_era5 is not None:
        try:
            t_var = "valid_time" if "valid_time" in ds_era5.coords else "time"
            t_val = np.datetime64(str(dt.isoformat())[:19])
            ds_t = ds_era5.sel({t_var: t_val}, method="nearest")
            u10 = float(ds_t["u10"].sel(latitude=lat, longitude=lon, method="nearest").values)
            v10 = float(ds_t["v10"].sel(latitude=lat, longitude=lon, method="nearest").values)
            if not np.isnan(u10) and not np.isnan(v10):
                w_u, w_v = u10, v10
        except Exception:
            pass

    # If both files have no real coverage, provide baseline with honest source tag
    if not cov["has_real_forcing"] and c_u == 0.0 and c_v == 0.0 and w_u == 0.0 and w_v == 0.0:
        # Regional oceanographic baseline: 0.25 m/s SW (215°), 5.5 m/s wind SSW (205°)
        c_speed = 0.25
        c_dir = 215.0
        w_speed = 5.5
        w_dir = 205.0
        c_u = c_speed * math.sin(math.radians(c_dir))
        c_v = c_speed * math.cos(math.radians(c_dir))
        w_u = w_speed * math.sin(math.radians(w_dir))
        w_v = w_speed * math.cos(math.radians(w_dir))
        c_source = "No real forcing data for this date"
        w_source = "No real forcing data for this date"
        c_prov = "empirical_baseline"

    return c_u, c_v, w_u, w_v, c_source, w_source, c_prov


def get_environmental_forcing(lat: float, lon: float, dt: Optional[datetime] = None) -> Dict[str, Any]:
    """Compatibility helper returning summary forcing dictionary."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    c_u, c_v, w_u, w_v, c_src, w_src, prov = sample_forcing_vector(lat, lon, dt)
    c_speed = float(np.hypot(c_u, c_v))
    c_dir = float((np.degrees(np.arctan2(c_u, c_v)) + 360) % 360)
    w_speed = float(np.hypot(w_u, w_v))
    w_dir = float((np.degrees(np.arctan2(w_u, w_v)) + 360) % 360)

    return {
        "current_speed_ms": round(max(0.01, c_speed), 3),
        "current_dir_deg": round(c_dir, 1),
        "wind_speed_ms": round(max(0.1, w_speed), 2),
        "wind_dir_deg": round(w_dir, 1),
        "current_source": c_src,
        "wind_source": w_src,
        "data_provenance": prov,
        "source": f"Current: {c_src} | Wind: {w_src}",
    }


def extract_kde_contours(lons: np.ndarray, lats: np.ndarray, grid_size: int = 60) -> Tuple[Optional[dict], Optional[dict], Optional[dict]]:
    """
    Compute 2D Gaussian Kernel Density Estimation (KDE) on particle cloud.
    Extracts 50% and 90% probability contour polygons via OpenCV contour tracing.
    Returns: (contour_50_geojson, contour_90_geojson, heatmap_geojson)
    """
    if len(lons) < 5 or np.std(lons) < 1e-5 or np.std(lats) < 1e-5:
        pt = Point(float(np.mean(lons)), float(np.mean(lats)))
        poly50 = pt.buffer(0.02)
        poly90 = pt.buffer(0.04)
        return (
            {"type": "Polygon", "coordinates": [list(poly50.exterior.coords)]},
            {"type": "Polygon", "coordinates": [list(poly90.exterior.coords)]},
            {"type": "FeatureCollection", "features": [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [float(pt.x), float(pt.y)]}, "properties": {"density": 1.0}}], "peak": {"lon": float(pt.x), "lat": float(pt.y)}}
        )

    coords = np.vstack([lons, lats])
    kde = gaussian_kde(coords)

    pad_lon = max(0.02, float(np.std(lons)) * 1.5)
    pad_lat = max(0.02, float(np.std(lats)) * 1.5)
    lon_bins = np.linspace(lons.min() - pad_lon, lons.max() + pad_lon, grid_size)
    lat_bins = np.linspace(lats.min() - pad_lat, lats.max() + pad_lat, grid_size)
    lon_grid, lat_grid = np.meshgrid(lon_bins, lat_bins)
    grid_coords = np.vstack([lon_grid.ravel(), lat_grid.ravel()])
    z = kde(grid_coords).reshape(grid_size, grid_size)

    z_flat = z.ravel()
    z_sorted = np.sort(z_flat)[::-1]
    z_cumsum = np.cumsum(z_sorted) / max(np.sum(z_sorted), 1e-9)
    level_50 = float(z_sorted[min(np.searchsorted(z_cumsum, 0.50), len(z_sorted) - 1)])
    level_90 = float(z_sorted[min(np.searchsorted(z_cumsum, 0.90), len(z_sorted) - 1)])

    dlon = lon_bins[1] - lon_bins[0]
    dlat = lat_bins[1] - lat_bins[0]

    contours_out = {}
    for lvl, name in [(level_50, "50"), (level_90, "90")]:
        mask = (z >= lvl).astype(np.uint8) * 255
        cv_contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        polys = []
        for c in cv_contours:
            if len(c) >= 3:
                pts = []
                for pt in c:
                    col, row = pt[0]
                    p_lon = lon_bins[0] + col * dlon
                    p_lat = lat_bins[0] + row * dlat
                    pts.append((round(float(p_lon), 6), round(float(p_lat), 6)))
                if len(pts) >= 3:
                    try:
                        p = Polygon(pts)
                        if not p.is_valid:
                            p = p.buffer(0)
                        if not p.is_empty:
                            polys.append(p)
                    except Exception:
                        pass
        if polys:
            merged = unary_union(polys)
            if isinstance(merged, (Polygon, MultiPolygon)):
                geom = {"type": merged.geom_type, "coordinates": [list(merged.exterior.coords)] if merged.geom_type == "Polygon" else [[list(p.exterior.coords)] for p in merged.geoms]}
                contours_out[name] = geom

    peak_idx = np.unravel_index(np.argmax(z), z.shape)
    peak_lon = float(lon_grid[peak_idx])
    peak_lat = float(lat_grid[peak_idx])

    heatmap_features = []
    step = max(1, grid_size // 15)
    max_z = float(np.max(z)) or 1.0
    for r in range(0, grid_size, step):
        for c in range(0, grid_size, step):
            val = float(z[r, c])
            norm_val = round(val / max_z, 3)
            if norm_val > 0.05:
                heatmap_features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [round(float(lon_grid[r, c]), 5), round(float(lat_grid[r, c]), 5)]},
                    "properties": {"density": norm_val}
                })

    heatmap_geojson = {
        "type": "FeatureCollection",
        "features": heatmap_features,
        "peak": {"lon": round(peak_lon, 5), "lat": round(peak_lat, 5)}
    }

    return contours_out.get("50"), contours_out.get("90"), heatmap_geojson


def simulate_drift(
    spill_lat: float,
    spill_lon: float,
    spill_time: datetime,
    direction: str = "backward",
    duration_hours: int = 24,
    num_particles: int = 500,
    current_speed_ms: Optional[float] = None,
    current_dir_deg: Optional[float] = None,
    wind_speed_ms: Optional[float] = None,
    wind_dir_deg: Optional[float] = None,
    wind_drift_factor: float = 0.03,
    diffusion_coeff: float = 50.0,
    initial_spread_deg: float = 0.005,
    random_seed: Optional[int] = None,
    overrides: Optional[dict] = None,
) -> Dict[str, Any]:
    """
    Lagrangian particle drift using 4th-order Runge-Kutta (RK4) integration,
    coastline segment collision stopping, and 50%/90% KDE contours.
    """
    if random_seed is not None:
        np.random.seed(random_seed)

    if spill_time.tzinfo is None:
        spill_time = spill_time.replace(tzinfo=timezone.utc)

    # Handle direct parameter overrides if passed as keyword arguments
    if current_speed_ms is not None or wind_speed_ms is not None:
        if overrides is None:
            overrides = {}
        if current_speed_ms is not None:
            overrides["current_speed_ms"] = current_speed_ms
        if current_dir_deg is not None:
            overrides["current_dir_deg"] = current_dir_deg
        if wind_speed_ms is not None:
            overrides["wind_speed_ms"] = wind_speed_ms
        if wind_dir_deg is not None:
            overrides["wind_dir_deg"] = wind_dir_deg

    cov = check_forcing_coverage(spill_time)
    prep_coast, mls_coast = _get_coastline()

    dt_seconds = 600.0
    num_steps = int(max(1, duration_hours * 3600 / dt_seconds))
    time_sign = -1.0 if direction == "backward" else 1.0

    if initial_spread_deg > 0:
        lats = np.random.normal(spill_lat, initial_spread_deg, num_particles)
        lons = np.random.normal(spill_lon, initial_spread_deg, num_particles)
    else:
        lats = np.full(num_particles, spill_lat, dtype=float)
        lons = np.full(num_particles, spill_lon, dtype=float)

    beached = np.zeros(num_particles, dtype=bool)

    meters_per_deg_lat = 111320.0
    trajectory_points = []
    forcing_timeline = []
    snapshot_interval = max(1, num_steps // 24)

    current_source = cov["current_source"]
    wind_source = cov["wind_source"]

    for step in range(num_steps):
        elapsed_sec = step * dt_seconds * time_sign
        step_time = spill_time + timedelta(seconds=elapsed_sec)

        c_u, c_v, w_u, w_v, c_src, w_src, _ = sample_forcing_vector(float(np.mean(lats)), float(np.mean(lons)), step_time, overrides)
        current_source = c_src
        wind_source = w_src

        c_speed = float(np.hypot(c_u, c_v))
        c_dir = float((np.degrees(np.arctan2(c_u, c_v)) + 360) % 360)
        w_speed = float(np.hypot(w_u, w_v))
        w_dir = float((np.degrees(np.arctan2(w_u, w_v)) + 360) % 360)

        if step % snapshot_interval == 0:
            forcing_timeline.append({
                "step": step,
                "time": step_time.isoformat(),
                "current_speed_ms": round(c_speed, 3),
                "current_dir_deg": round(c_dir, 1),
                "wind_speed_ms": round(w_speed, 2),
                "wind_dir_deg": round(w_dir, 1),
            })

        active_idx = np.where(~beached)[0]
        if len(active_idx) > 0:
            act_lats = lats[active_idx]
            act_lons = lons[active_idx]
            meters_per_deg_lon = meters_per_deg_lat * np.cos(np.radians(act_lats))

            # RK4 implementation for spatial advection
            # k1 at current position
            tot_u1 = c_u + wind_drift_factor * w_u
            tot_v1 = c_v + wind_drift_factor * w_v

            # k2 at midpoint
            mid_lat1 = act_lats + 0.5 * time_sign * (tot_v1 * dt_seconds / meters_per_deg_lat)
            mid_lon1 = act_lons + 0.5 * time_sign * (tot_u1 * dt_seconds / meters_per_deg_lon)
            c_u2, c_v2, w_u2, w_v2, _, _, _ = sample_forcing_vector(float(np.mean(mid_lat1)), float(np.mean(mid_lon1)), step_time + timedelta(seconds=0.5 * dt_seconds * time_sign), overrides)
            tot_u2 = c_u2 + wind_drift_factor * w_u2
            tot_v2 = c_v2 + wind_drift_factor * w_v2

            # k3 at midpoint
            mid_lat2 = act_lats + 0.5 * time_sign * (tot_v2 * dt_seconds / meters_per_deg_lat)
            mid_lon2 = act_lons + 0.5 * time_sign * (tot_u2 * dt_seconds / meters_per_deg_lon)
            c_u3, c_v3, w_u3, w_v3, _, _, _ = sample_forcing_vector(float(np.mean(mid_lat2)), float(np.mean(mid_lon2)), step_time + timedelta(seconds=0.5 * dt_seconds * time_sign), overrides)
            tot_u3 = c_u3 + wind_drift_factor * w_u3
            tot_v3 = c_v3 + wind_drift_factor * w_v3

            # k4 at full step
            end_lat = act_lats + time_sign * (tot_v3 * dt_seconds / meters_per_deg_lat)
            end_lon = act_lons + time_sign * (tot_u3 * dt_seconds / meters_per_deg_lon)
            c_u4, c_v4, w_u4, w_v4, _, _, _ = sample_forcing_vector(float(np.mean(end_lat)), float(np.mean(end_lon)), step_time + timedelta(seconds=dt_seconds * time_sign), overrides)
            tot_u4 = c_u4 + wind_drift_factor * w_u4
            tot_v4 = c_v4 + wind_drift_factor * w_v4

            # RK4 weighted velocity
            avg_u = (tot_u1 + 2.0 * tot_u2 + 2.0 * tot_u3 + tot_u4) / 6.0
            avg_v = (tot_v1 + 2.0 * tot_v2 + 2.0 * tot_v3 + tot_v4) / 6.0

            dlat_adv = time_sign * (avg_v * dt_seconds / meters_per_deg_lat)
            dlon_adv = time_sign * (avg_u * dt_seconds / meters_per_deg_lon)

            if diffusion_coeff > 0:
                diff_scale = np.sqrt(2.0 * diffusion_coeff * dt_seconds)
                dlat_diff = np.random.normal(0, diff_scale / meters_per_deg_lat, len(active_idx))
                dlon_diff = np.random.normal(0, diff_scale / meters_per_deg_lon, len(active_idx))
            else:
                dlat_diff = 0.0
                dlon_diff = 0.0

            next_lats = act_lats + dlat_adv + dlat_diff
            next_lons = act_lons + dlon_adv + dlon_diff

            # Coastline collision check
            if prep_coast is not None and mls_coast is not None:
                min_lon, max_lon = min(float(np.min(act_lons)), float(np.min(next_lons))), max(float(np.max(act_lons)), float(np.max(next_lons)))
                min_lat, max_lat = min(float(np.min(act_lats)), float(np.min(next_lats))), max(float(np.max(act_lats)), float(np.max(next_lats)))
                step_box = box(min_lon, min_lat, max_lon, max_lat)
                if prep_coast.intersects(step_box):
                    for local_i, global_i in enumerate(active_idx):
                        old_pt = (act_lons[local_i], act_lats[local_i])
                        new_pt = (next_lons[local_i], next_lats[local_i])
                        seg = LineString([old_pt, new_pt])
                        if prep_coast.intersects(seg):
                            inter = mls_coast.intersection(seg)
                            if not inter.is_empty:
                                if inter.geom_type == "Point":
                                    next_lons[local_i] = inter.x
                                    next_lats[local_i] = inter.y
                                elif hasattr(inter, "geoms"):
                                    first_pt = inter.geoms[0]
                                    if hasattr(first_pt, "x"):
                                        next_lons[local_i] = first_pt.x
                                        next_lats[local_i] = first_pt.y
                            beached[global_i] = True

            lats[active_idx] = next_lats
            lons[active_idx] = next_lons

        if step % snapshot_interval == 0 or step == num_steps - 1:
            trajectory_points.append({
                "time": step_time.isoformat(),
                "lat": round(float(np.mean(lats)), 6),
                "lon": round(float(np.mean(lons)), 6),
                "spread_lat": round(float(np.std(lats)), 6),
                "spread_lon": round(float(np.std(lons)), 6),
                "probability": round(max(0.1, 1.0 - (step / num_steps) * 0.5), 3),
                "beached_count": int(np.sum(beached)),
            })

    c50_gj, c90_gj, heatmap_gj = extract_kde_contours(lons, lats)

    cone_geojson = c90_gj
    if cone_geojson is None:
        pts = [Point(lo, la) for la, lo in zip(lats, lons)]
        hull = MultiPoint(pts).convex_hull
        if isinstance(hull, Polygon):
            cone_geojson = {"type": "Polygon", "coordinates": [[[round(c[0], 6), round(c[1], 6)] for c in hull.exterior.coords]]}

    if direction == "backward":
        sim_start = spill_time - timedelta(hours=duration_hours)
        sim_end = spill_time
    else:
        sim_start = spill_time
        sim_end = spill_time + timedelta(hours=duration_hours)

    parameters = {
        "method": "rk4_lagrangian_particle_tracking",
        "current_source": current_source,
        "wind_source": wind_source,
        "data_provenance": cov["data_provenance"],
        "forcing_timeline": forcing_timeline,
        "duration_hours": duration_hours,
        "num_particles": num_particles,
        "diffusion_coeff": diffusion_coeff,
        "dt_seconds": dt_seconds,
        "beached_particles": int(np.sum(beached)),
        "forcing_version_hash": get_file_version_hash(),
        "has_real_forcing": cov["has_real_forcing"],
        "note": f"Current: {current_source} | Wind: {wind_source}",
    }

    return {
        "direction": direction,
        "sim_start_time": sim_start.isoformat(),
        "sim_end_time": sim_end.isoformat(),
        "duration_hours": duration_hours,
        "trajectory_points": trajectory_points,
        "cone_geojson": cone_geojson,
        "contour_50_geojson": c50_gj,
        "contour_90_geojson": c90_gj,
        "origin_heatmap": heatmap_gj,
        "origin_heatmap_geojson": heatmap_gj,
        "parameters": parameters,
        "data_provenance": cov["data_provenance"],
    }


def run_backward_drift(spill_lat: float, spill_lon: float, spill_time: datetime, duration_hours: int = 24) -> Dict[str, Any]:
    return simulate_drift(spill_lat, spill_lon, spill_time, direction="backward", duration_hours=duration_hours)


def run_forward_drift(spill_lat: float, spill_lon: float, spill_time: datetime, duration_hours: int = 48) -> Dict[str, Any]:
    return simulate_drift(spill_lat, spill_lon, spill_time, direction="forward", duration_hours=duration_hours)

