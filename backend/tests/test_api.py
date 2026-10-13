"""API smoke tests against an isolated SQLite DB: auth/roles, spills, drift, attribution, upload."""
import asyncio
import io
import os
import pathlib

import numpy as np
import pytest
from fastapi.testclient import TestClient

BACKEND = pathlib.Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def client():
    db_path = BACKEND / "test_oilspill.db"
    if db_path.exists():
        try:
            db_path.unlink()
        except Exception:
            pass
    from scripts.seed_demo_data import seed
    asyncio.run(seed(reset=True))
    from app.main import app
    with TestClient(app) as c:
        yield c
    from app.database import engine
    asyncio.run(engine.dispose())
    if db_path.exists():
        try:
            db_path.unlink()
        except Exception:
            pass


def _login(client, username):
    r = client.post("/api/auth/login", json={"username": username, "password": "demo123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_health_and_limitations(client):
    assert client.get("/api/health").json()["status"] == "ok"
    lim = client.get("/api/limitations").json()["limitations"]
    assert any("INVESTIGATIVE LEAD" in l for l in lim)


def test_role_check_blocks_public_from_suspects(client):
    h = _login(client, "public_user")
    assert client.get("/api/attribution/1/suspects", headers=h).status_code == 403


def test_seeded_spill_has_origin_window(client):
    h = _login(client, "coast_guard")
    s = client.get("/api/spills/1", headers=h).json()
    assert s["origin_time_earliest"] < s["origin_time_likely"] < s["origin_time_latest"]
    assert s["data_provenance"] == "synthetic_demo"


def test_backward_drift_has_real_cone_and_heatmap(client):
    h = _login(client, "coast_guard")
    d = client.get("/api/drift/1/backward", headers=h).json()
    assert d["origin_cone_geojson"]["type"] == "Polygon"
    assert len(d["origin_heatmap_geojson"]["features"]) > 5
    assert d["parameters"]["method"].startswith("rk4")
    assert d["forcing_timeline"] and len({p["current_dir_deg"] for p in d["forcing_timeline"]}) > 1  # forcing varies in time


def test_suspects_come_from_real_tracks(client):
    h = _login(client, "coast_guard")
    sus = client.get("/api/attribution/1/suspects", headers=h, params={"top_n": 5}).json()
    assert sus and sus[0]["vessel_name"] == "MT ARABIAN STAR"
    ev = sus[0]["explanation"]["evidence"]
    assert ev["traffic"]["points_in_cone"] > 0 and ev["closest_fix"]["distance_nm"] < 5
    assert any(g["evidence"].startswith("STRONG") for g in ev["ais_gaps"])
    traffic = client.get("/api/attribution/1/traffic", headers=h).json()
    assert traffic["vessels_filtered"] >= 3
    reasons = " ".join(f["reason"] for f in traffic["filtered_out"])
    assert "transit" in reasons and "edge clip" in reasons


def test_anomaly_feed_is_populated_by_detectors(client):
    h = _login(client, "coast_guard")
    feed = client.get("/api/attribution/anomalies/feed", headers=h).json()
    assert {a["anomaly_type"] for a in feed} >= {"ais_gap", "speed_drop", "course_change"}


def test_whatif_drift_changes_cone(client):
    h = _login(client, "coast_guard")
    a = client.post("/api/drift/1/whatif", headers=h, json={"duration_hours": 6, "current_speed_ms": 0.6, "current_dir_deg": 0}).json()
    b = client.post("/api/drift/1/whatif", headers=h, json={"duration_hours": 6, "current_speed_ms": 0.6, "current_dir_deg": 180}).json()
    assert a["trajectory_points"][-1]["lat"] < b["trajectory_points"][-1]["lat"]
    assert a["parameters"]["persisted"] is False


def _make_geotiff(path, w=300, h=200):
    pytest.importorskip("rasterio")
    import rasterio
    from rasterio.transform import from_origin
    img = np.full((h, w), 180, dtype=np.uint8)
    img[60:120, 90:210] = 25  # dark slick, offset from centre
    tr = from_origin(71.80, 18.95, 0.0005, 0.0005)  # ~55 m pixels, top-left at 71.80E 18.95N
    with rasterio.open(path, "w", driver="GTiff", height=h, width=w, count=1, dtype="uint8", crs="EPSG:4326", transform=tr) as dst:
        dst.write(img, 1)


def test_upload_geotiff_is_georeferenced_and_timestamped(client, tmp_path):
    h = _login(client, "coast_guard")
    p = tmp_path / "S1A_IW_GRDH_1SDV_20240314T010000_20240314T010025_052950_066A2E_TEST.tif"
    _make_geotiff(p)
    r = client.post("/api/spills/upload-sar", headers=h, files={"file": (p.name, p.read_bytes(), "image/tiff")},
                    data={"lat": 0, "lon": 0, "region": "west_coast", "run_attribution": "false"})
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["georef_method"] == "geotiff_affine"
    assert s["timestamp_source"] == "sentinel1_filename" and s["image_timestamp"].startswith("2024-03-14T01:00:00")
    # slick centre = pixel (150, 90) → lon 71.80+150*0.0005 = 71.875, lat 18.95-90*0.0005 = 18.905
    assert abs(s["centroid_lon"] - 71.875) < 0.002 and abs(s["centroid_lat"] - 18.905) < 0.002
    assert s["slick_geojson"]["type"] == "MultiPolygon"
    assert s["origin_time_likely"] < s["image_timestamp"]
    assert s["wind_gate"]["status"] in ("ok", "low_wind_lookalike_risk", "high_wind_signature_suppressed", "unknown")
    assert len(s["sar_sha256"]) == 64


def test_upload_png_is_labelled_approximate(client):
    h = _login(client, "coast_guard")
    png = BACKEND / "data" / "sar" / "demo_for_judges" / "demo_oil_spill_large.png"
    r = client.post("/api/spills/upload-sar", headers=h, files={"file": ("demo_oil_spill_large.png", png.read_bytes(), "image/png")},
                    data={"lat": 18.85, "lon": 71.90, "pixel_size_m": 10, "run_attribution": "false"})
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["georef_method"] == "approximate_center_scale" and "APPROXIMATE" in s["georef_note"]
    assert s["timestamp_source"] == "upload_time"
