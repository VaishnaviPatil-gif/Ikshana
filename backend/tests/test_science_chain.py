"""
Unit tests for the science chain: georeferencing, capture time, age → origin window,
drift integrator, scoring weights, haversine.
"""
import math
from datetime import datetime, timezone, timedelta

import numpy as np
import pytest
from shapely.geometry import Polygon, MultiPolygon

from app.spills.georef import (
    parse_capture_timestamp, approximate_georef, pixel_to_lonlat, pixel_polygons_to_geojson,
    estimate_age_range, origin_time_window, wind_gate,
)
from app.attribution.scoring import WEIGHTS, haversine_nm, compute_suspect_score
from app.drift.simulation import simulate_drift
from ml.predict import characterize_geometry


# ---------------- capture time (Critical 4) ----------------
def test_sentinel1_filename_timestamp():
    ts, src = parse_capture_timestamp("S1A_IW_GRDH_1SDV_20240315T005512_20240315T005537_052950_066A2E_1234.tiff")
    assert src == "sentinel1_filename"
    assert ts == datetime(2024, 3, 15, 0, 55, 12, tzinfo=timezone.utc)


def test_generic_and_missing_timestamp():
    ts, src = parse_capture_timestamp("scene_20240101_120000.png")
    assert ts == datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc) and src == "filename_pattern"
    ts, src = parse_capture_timestamp("demo_oil_spill_large.png")
    assert ts is None and src == "none"


# ---------------- georeferencing (Critical 3) ----------------
def test_approximate_georef_roundtrip_centre_and_scale():
    g = approximate_georef(1000, 800, center_lat=18.85, center_lon=71.90, pixel_size_m=10.0)
    lon, lat = pixel_to_lonlat(np.array([500.0]), np.array([400.0]), g)
    assert abs(lon[0] - 71.90) < 1e-6 and abs(lat[0] - 18.85) < 1e-6
    # 100 px east ≈ 1000 m
    lon2, _ = pixel_to_lonlat(np.array([600.0]), np.array([400.0]), g)
    metres = (lon2[0] - lon[0]) * 111_320 * math.cos(math.radians(18.85))
    assert abs(metres - 1000) < 1.0
    assert g.method == "approximate_center_scale" and "APPROXIMATE" in g.note


def test_pixel_polygon_becomes_lonlat_multipolygon():
    g = approximate_georef(512, 512, 18.85, 71.90, 10.0)
    px_poly = MultiPolygon([Polygon([(100, 100), (200, 100), (200, 180), (100, 180)])])
    gj = pixel_polygons_to_geojson(px_poly, g)
    assert gj["type"] == "MultiPolygon"
    lons = [c[0] for ring in gj["coordinates"][0] for c in ring]
    lats = [c[1] for ring in gj["coordinates"][0] for c in ring]
    assert 71.8 < min(lons) < 71.9 and 18.85 < min(lats) < 18.9   # top-left quadrant of the scene


def test_characterize_uses_pixel_size():
    poly = MultiPolygon([Polygon([(0, 0), (100, 0), (100, 100), (0, 100)])])
    a10 = characterize_geometry(poly, pixel_size_m=10.0)["area_sq_km"]
    a20 = characterize_geometry(poly, pixel_size_m=20.0)["area_sq_km"]
    assert abs(a10 - 1.0) < 1e-6 and abs(a20 - 4.0) < 1e-6


# ---------------- age range + origin window ----------------
def test_age_range_is_ordered_and_window_precedes_capture():
    age = estimate_age_range(area_sq_km=12.5, elongation_ratio=3.2, fragmentation_index=2.1, wind_speed_ms=5.5)
    assert 0 <= age.hours_min < age.hours_likely < age.hours_max
    cap = datetime(2024, 3, 15, 5, 0, tzinfo=timezone.utc)
    w = origin_time_window(cap, age)
    assert w["origin_time_earliest"] < w["origin_time_likely"] < w["origin_time_latest"] <= cap
    assert "Released between" in w["human"]


def test_strong_wind_shifts_age_younger():
    calm = estimate_age_range(10, 2.0, 3.0, wind_speed_ms=2.0)
    windy = estimate_age_range(10, 2.0, 3.0, wind_speed_ms=11.0)
    assert windy.hours_max < calm.hours_max


def test_wind_gate_bands():
    assert wind_gate(1.5)["status"] == "low_wind_lookalike_risk"
    assert wind_gate(6.0)["status"] == "ok"
    assert wind_gate(13.0)["status"] == "high_wind_signature_suppressed"
    assert wind_gate(None)["status"] == "unknown"


# ---------------- drift (Critical 5) ----------------
def test_rk4_constant_forcing_matches_analytic_displacement():
    """With a fixed 0.5 m/s northward current, no wind and no diffusion, the particle
    cloud must move 0.5*3600*6 = 10.8 km north in 6 h (RK4 on a constant field is exact)."""
    t0 = datetime(2024, 3, 15, 6, 0, tzinfo=timezone.utc)
    r = simulate_drift(18.0, 72.0, t0, direction="forward", duration_hours=6, num_particles=50,
                       diffusion_coeff=0.0, initial_spread_deg=0.0, random_seed=1,
                       overrides={"current_speed_ms": 0.5, "current_dir_deg": 0.0, "wind_speed_ms": 0.0, "wind_dir_deg": 0.0})
    end = r["trajectory_points"][-1]
    dist_m = (end["lat"] - 18.0) * 111_320
    assert abs(dist_m - 10_800) < 50
    assert abs(end["lon"] - 72.0) < 1e-4
    assert r["parameters"]["method"].startswith("rk4")


def test_backward_run_reverses_forward_run():
    t0 = datetime(2024, 3, 15, 6, 0, tzinfo=timezone.utc)
    ov = {"current_speed_ms": 0.3, "current_dir_deg": 45.0, "wind_speed_ms": 0.0, "wind_dir_deg": 0.0}
    f = simulate_drift(18.0, 72.0, t0, "forward", 3, 20, diffusion_coeff=0, initial_spread_deg=0, random_seed=1, overrides=ov)
    b = simulate_drift(18.0, 72.0, t0, "backward", 3, 20, diffusion_coeff=0, initial_spread_deg=0, random_seed=1, overrides=ov)
    fe, be = f["trajectory_points"][-1], b["trajectory_points"][-1]
    assert abs((fe["lat"] - 18.0) + (be["lat"] - 18.0)) < 1e-5
    assert abs((fe["lon"] - 72.0) + (be["lon"] - 72.0)) < 1e-5
    assert b["sim_start_time"] < b["sim_end_time"] == t0.isoformat()


def test_drift_outputs_cone_heatmap_and_forcing_timeline():
    t0 = datetime(2024, 3, 15, 6, 0, tzinfo=timezone.utc)
    r = simulate_drift(18.85, 71.9, t0, "backward", 6, 100, random_seed=3)
    assert r["cone_geojson"]["type"] == "Polygon"
    assert r["origin_heatmap"]["features"] and "peak" in r["origin_heatmap"]
    assert len(r["parameters"]["forcing_timeline"]) >= 5
    assert "current_source" in r["parameters"] and "wind_source" in r["parameters"]


def test_coastline_segment_collision_stops_particles():
    """Particles pushed eastward towards the Mumbai coastline must be stopped at the coast LineString."""
    t0 = datetime(2024, 3, 15, 6, 0, tzinfo=timezone.utc)
    # Start just offshore of Mumbai and push strongly East (into land)
    r = simulate_drift(18.90, 72.78, t0, direction="forward", duration_hours=6, num_particles=20,
                       diffusion_coeff=0.0, initial_spread_deg=0.0,
                       overrides={"current_speed_ms": 1.0, "current_dir_deg": 90.0, "wind_speed_ms": 0.0, "wind_dir_deg": 0.0})
    assert r["parameters"]["beached_particles"] == 20
    # Longitude should stop around ~72.81 (coastline) and not penetate inland past 72.85
    assert 72.80 < r["trajectory_points"][-1]["lon"] < 72.83



# ---------------- scoring ----------------
def test_scoring_weights_sum_to_one():
    assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9


def test_haversine_known_distance():
    # 1 degree of latitude ≈ 60 nm
    assert abs(haversine_nm(18.0, 72.0, 19.0, 72.0) - 60.0) < 0.2


def test_compute_suspect_score_language_and_bounds():
    r = compute_suspect_score(
        proximity_data={"vessel_lat": 18.86, "vessel_lon": 71.91, "origin_lat": 18.85, "origin_lon": 71.90},
        time_overlap_data={"vessel_time_in_area_hours": 5, "origin_window_hours": 10},
        ais_gap_data={"gap_duration_minutes": 120, "gap_near_spill": True},
        speed_data={"speed_drop_events": 1, "min_speed_observed": 1.0},
        course_data={"course_change_events": 1, "max_course_change_deg": 120},
        route_data={"deviation_nm": 8, "sinuosity_ratio": 1.5},
        isolation_forest_score=0.9,
    )
    assert 0 <= r["total_score"] <= 100 and 0 <= r["confidence"] <= 1
    assert "CANDIDATE" in r["explanation"]["summary"] and "culprit" not in r["explanation"]["summary"].lower()
