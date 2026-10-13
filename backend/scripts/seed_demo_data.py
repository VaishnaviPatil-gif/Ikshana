"""
Seed demo data into the database.
Creates: 4 default users, 3 demo spills with full pipeline results,
vessels with AIS tracks, suspect scores, anomaly flags, and impact assessments.

Run: python -m scripts.seed_demo_data
"""
import asyncio
import sys
import os
from datetime import datetime, timedelta, timezone

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine, async_session, Base
from app.auth.models import User
from app.auth.jwt import hash_password
from app.spills.models import Spill
from app.vessels.models import Vessel, AISTrack
from app.attribution.models import SuspectScore, AnomalyFlag
from app.drift.models import DriftSimulation
from app.impact.models import ImpactAssessment


async def seed(reset: bool = False):
    # Create all tables
    async with engine.begin() as conn:
        if "postgresql" in str(engine.url):
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            except Exception as e:
                print(f"PostGIS notice: {e}")
        if reset:
            await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Tables created")

    async with async_session() as db:
        # ============ USERS ============
        users = [
            User(
                username="public_user", email="public@demo.com",
                password_hash=hash_password("demo123"),
                role="public", assigned_region=None,
            ),
            User(
                username="coast_guard", email="cg@demo.com",
                password_hash=hash_password("demo123"),
                role="coast_guard", assigned_region=None,
            ),
            User(
                username="regional_mgr", email="rm@demo.com",
                password_hash=hash_password("demo123"),
                role="regional_manager", assigned_region="west_coast",
            ),
            User(
                username="authority", email="auth@demo.com",
                password_hash=hash_password("demo123"),
                role="higher_authority", assigned_region=None,
            ),
        ]
        for u in users:
            db.add(u)
        await db.flush()
        print(f"[OK] Created {len(users)} users (password: demo123 for all)")

        # ============ SPILLS ============
        spill_time = datetime(2024, 3, 15, 6, 0, 0, tzinfo=timezone.utc)
        spills = [
            Spill(
                name="SPILL-20240315-001",
                detected_at=spill_time,
                image_timestamp=spill_time - timedelta(hours=1),
                centroid_lat=18.850,
                centroid_lon=71.900,
                slick_geojson={
                    "type": "Polygon",
                    "coordinates": [[
                        [71.86, 18.82],
                        [71.94, 18.83],
                        [71.95, 18.88],
                        [71.88, 18.87],
                        [71.86, 18.82]
                    ]]
                },
                area_sq_km=12.5,
                perimeter_km=18.3,
                elongation_ratio=3.2,
                fragmentation_index=2.1,
                age_estimate="hours",
                age_hours_min=4.0,
                age_hours_max=12.0,
                age_hours_likely=7.0,
                origin_time_earliest=spill_time - timedelta(hours=12),
                origin_time_likely=spill_time - timedelta(hours=7),
                origin_time_latest=spill_time - timedelta(hours=4),
                data_provenance="synthetic_demo",
                severity="high",
                validation_status="confirmed",
                validated_by=2,  # coast_guard
                validated_at=spill_time + timedelta(hours=2),
                region="west_coast",
                model_confidence={"oil": 0.89, "lookalike": 0.08, "no_oil": 0.03},
            ),
            Spill(
                name="SPILL-20240312-002",
                detected_at=spill_time - timedelta(days=3),
                image_timestamp=spill_time - timedelta(days=3, hours=1),
                centroid_lat=19.120,
                centroid_lon=72.150,
                slick_geojson={
                    "type": "Polygon",
                    "coordinates": [[
                        [72.12, 19.10],
                        [72.18, 19.11],
                        [72.17, 19.14],
                        [72.13, 19.13],
                        [72.12, 19.10]
                    ]]
                },
                area_sq_km=3.8,
                perimeter_km=8.1,
                elongation_ratio=2.1,
                fragmentation_index=5.7,
                age_estimate="day",
                severity="medium",
                validation_status="confirmed",
                validated_by=2,
                validated_at=spill_time - timedelta(days=2),
                region="west_coast",
                model_confidence={"oil": 0.75, "lookalike": 0.18, "sea": 0.07},
            ),
            Spill(
                name="SPILL-20240310-003",
                detected_at=spill_time - timedelta(days=5),
                image_timestamp=spill_time - timedelta(days=5, hours=2),
                centroid_lat=9.150,
                centroid_lon=79.350,
                slick_geojson={
                    "type": "Polygon",
                    "coordinates": [[
                        [79.28, 9.10],
                        [79.42, 9.12],
                        [79.40, 9.20],
                        [79.30, 9.18],
                        [79.28, 9.10]
                    ]]
                },
                area_sq_km=52.0,
                perimeter_km=45.7,
                elongation_ratio=5.8,
                fragmentation_index=0.8,
                age_estimate="fresh",
                severity="critical",
                validation_status="confirmed",
                region="tamil_nadu",
                model_confidence={"oil": 0.94, "lookalike": 0.04, "sea": 0.02},
            ),
            Spill(
                name="SPILL-20240316-004",
                detected_at=spill_time - timedelta(hours=18),
                image_timestamp=spill_time - timedelta(hours=19),
                centroid_lat=22.480,
                centroid_lon=69.650,
                slick_geojson={
                    "type": "Polygon",
                    "coordinates": [[
                        [69.60, 22.45],
                        [69.70, 22.46],
                        [69.68, 22.52],
                        [69.58, 22.50],
                        [69.60, 22.45]
                    ]]
                },
                area_sq_km=28.4,
                perimeter_km=24.6,
                elongation_ratio=4.1,
                fragmentation_index=1.4,
                age_estimate="hours",
                age_hours_likely=5.0,
                severity="critical",
                validation_status="confirmed",
                region="gujarat",
                model_confidence={"oil": 0.92, "lookalike": 0.05, "sea": 0.03},
            ),
            Spill(
                name="SPILL-20240314-005",
                detected_at=spill_time - timedelta(days=1),
                image_timestamp=spill_time - timedelta(days=1, hours=2),
                centroid_lat=16.700,
                centroid_lon=82.400,
                slick_geojson={
                    "type": "Polygon",
                    "coordinates": [[
                        [82.35, 16.66],
                        [82.44, 16.68],
                        [82.42, 16.74],
                        [82.34, 16.72],
                        [82.35, 16.66]
                    ]]
                },
                area_sq_km=18.2,
                perimeter_km=17.5,
                elongation_ratio=3.0,
                fragmentation_index=2.0,
                age_estimate="day",
                age_hours_likely=14.0,
                severity="high",
                validation_status="confirmed",
                region="andhra_pradesh",
                model_confidence={"oil": 0.86, "lookalike": 0.10, "sea": 0.04},
            ),
            Spill(
                name="SPILL-20240313-006",
                detected_at=spill_time - timedelta(days=2),
                image_timestamp=spill_time - timedelta(days=2, hours=1),
                centroid_lat=9.920,
                centroid_lon=76.100,
                slick_geojson={
                    "type": "Polygon",
                    "coordinates": [[
                        [76.06, 9.88],
                        [76.14, 9.90],
                        [76.13, 9.95],
                        [76.05, 9.94],
                        [76.06, 9.88]
                    ]]
                },
                area_sq_km=9.5,
                perimeter_km=11.8,
                elongation_ratio=2.6,
                fragmentation_index=3.2,
                age_estimate="hours",
                age_hours_likely=6.0,
                severity="high",
                validation_status="confirmed",
                region="kerala",
                model_confidence={"oil": 0.88, "lookalike": 0.08, "sea": 0.04},
            ),
            Spill(
                name="SPILL-20240311-007",
                detected_at=spill_time - timedelta(days=4),
                image_timestamp=spill_time - timedelta(days=4, hours=3),
                centroid_lat=20.650,
                centroid_lon=87.050,
                slick_geojson={
                    "type": "Polygon",
                    "coordinates": [[
                        [86.98, 20.60],
                        [87.12, 20.62],
                        [87.10, 20.70],
                        [86.97, 20.68],
                        [86.98, 20.60]
                    ]]
                },
                area_sq_km=34.2,
                perimeter_km=31.0,
                elongation_ratio=4.5,
                fragmentation_index=1.1,
                age_estimate="fresh",
                age_hours_likely=3.0,
                severity="critical",
                validation_status="confirmed",
                region="bengal_odisha",
                model_confidence={"oil": 0.95, "lookalike": 0.03, "sea": 0.02},
            ),
            Spill(
                name="LOOKALIKE-20240316-008",
                detected_at=spill_time - timedelta(hours=8),
                image_timestamp=spill_time - timedelta(hours=9),
                centroid_lat=10.550,
                centroid_lon=72.600,
                slick_geojson={
                    "type": "Polygon",
                    "coordinates": [[
                        [72.56, 10.51],
                        [72.64, 10.52],
                        [72.63, 10.58],
                        [72.55, 10.57],
                        [72.56, 10.51]
                    ]]
                },
                area_sq_km=4.2,
                perimeter_km=7.5,
                elongation_ratio=1.2,
                fragmentation_index=1.0,
                age_estimate="fresh",
                age_hours_likely=2.0,
                severity="low",
                validation_status="lookalike",
                region="kerala",
                model_confidence={"oil": 0.05, "lookalike": 0.91, "sea": 0.04},
            ),
        ]
        for s in spills:
            if not getattr(s, 'confidence_score', None) and s.model_confidence:
                s.confidence_score = float(s.model_confidence.get("lookalike", 0.91) if s.validation_status == "lookalike" else s.model_confidence.get("oil", 0.88))
            db.add(s)
        await db.flush()
        for s in spills:
            await db.refresh(s)
        print(f"[OK] Created {len(spills)} demo spills (including verified oil slicks and look-alike shadows)")

        # ============ VESSELS ============
        vessels_data = [
            {"mmsi": "419001001", "vessel_name": "MT ARABIAN STAR", "imo": "9801001",
             "call_sign": "VJAA", "vessel_type": "Tanker", "length_m": 250, "width_m": 44,
             "draft_m": 14.5, "flag_state": "India"},
            {"mmsi": "419002002", "vessel_name": "MV OCEAN PRIDE", "imo": "9801002",
             "call_sign": "VJBB", "vessel_type": "Cargo", "length_m": 180, "width_m": 28,
             "draft_m": 10.2, "flag_state": "India"},
            {"mmsi": "419003003", "vessel_name": "MV MUMBAI EXPRESS", "imo": "9801003",
             "call_sign": "VJCC", "vessel_type": "Container", "length_m": 300, "width_m": 48,
             "draft_m": 13.0, "flag_state": "India"},
            {"mmsi": "419004004", "vessel_name": "FV SAGAR MITRA", "imo": "",
             "call_sign": "VJDD", "vessel_type": "Fishing", "length_m": 25, "width_m": 7,
             "draft_m": 3.5, "flag_state": "India"},
            {"mmsi": "419005005", "vessel_name": "MT CRUDE CARRIER", "imo": "9801005",
             "call_sign": "VJEE", "vessel_type": "Tanker", "length_m": 280, "width_m": 50,
             "draft_m": 16.0, "flag_state": "India"},
            {"mmsi": "538006006", "vessel_name": "MV SEA DRAGON", "imo": "9801006",
             "call_sign": "V7AA", "vessel_type": "Cargo", "length_m": 190, "width_m": 30,
             "draft_m": 11.0, "flag_state": "Marshall Islands"},
            {"mmsi": "636007007", "vessel_name": "MV LIBERIA STAR", "imo": "9801007",
             "call_sign": "ELAA", "vessel_type": "Tanker", "length_m": 220, "width_m": 38,
             "draft_m": 13.5, "flag_state": "Liberia"},
            {"mmsi": "419008008", "vessel_name": "TUG SAMRAT", "imo": "",
             "call_sign": "VJFF", "vessel_type": "Tug", "length_m": 35, "width_m": 10,
             "draft_m": 4.0, "flag_state": "India"},
            {"mmsi": "419009009", "vessel_name": "MT KUTCH VOYAGER", "imo": "9801009",
             "call_sign": "VJGG", "vessel_type": "Tanker", "length_m": 260, "width_m": 46,
             "draft_m": 15.0, "flag_state": "India"},
            {"mmsi": "419010010", "vessel_name": "MV VIZAG LEADER", "imo": "9801010",
             "call_sign": "VJHH", "vessel_type": "Cargo", "length_m": 210, "width_m": 32,
             "draft_m": 11.5, "flag_state": "India"},
            {"mmsi": "419011011", "vessel_name": "MV KOCHI PIONEER", "imo": "9801011",
             "call_sign": "VJII", "vessel_type": "Container", "length_m": 275, "width_m": 40,
             "draft_m": 12.8, "flag_state": "India"},
            {"mmsi": "419012012", "vessel_name": "MT PARADIP PRIDE", "imo": "9801012",
             "call_sign": "VJJJ", "vessel_type": "Tanker", "length_m": 240, "width_m": 42,
             "draft_m": 14.0, "flag_state": "India"},
        ]
        vessels = []
        for vd in vessels_data:
            v = Vessel(**vd)
            db.add(v)
            vessels.append(v)
        await db.flush()
        for v in vessels:
            await db.refresh(v)
        print(f"[OK] Created {len(vessels)} vessels")

        # ============ AIS TRACKS (realistic tracks for attribution & anomaly detection) ============
        spill_lat, spill_lon = 18.85, 71.90
        # Origin window for spill 0 is [spill_time - 10h, spill_time - 4h]
        # Cone is around lat 18.90, lon 71.94
        
        for v_idx, vessel in enumerate(vessels):
            # 16 hours of data: spill_time - 14h to spill_time + 2h at 5-min intervals (192 steps)
            num_points = 192
            for i in range(num_points):
                t = spill_time - timedelta(hours=14) + timedelta(minutes=i * 5)
                
                if v_idx == 0:  # MT ARABIAN STAR — Suspect vessel with gap, speed drop, course change
                    # Approaches cone from SW
                    if i < 50:
                        lat = 18.72 + i * 0.0034
                        lon = 71.74 + i * 0.0034
                        speed = 10.5
                        course = 45.0
                    elif 50 <= i <= 55:  # Inside cone (lat ~18.89-18.90, lon ~71.91-71.92)
                        lat = 18.89 + (i - 50) * 0.002
                        lon = 71.91 + (i - 50) * 0.002
                        speed = 10.0
                        course = 45.0
                    elif 56 <= i <= 79:  # AIS gap of 120 minutes (24 steps of 5 min)
                        continue
                    elif 80 <= i <= 86:  # Speed drop event after gap
                        lat = 18.91 + (i - 80) * 0.0005
                        lon = 71.94 + (i - 80) * 0.0005
                        speed = 0.8  # Speed drop below 2.0 kn
                        course = 45.0
                    elif i == 87:  # Sudden course change: 45 -> 165 (120 deg)
                        lat = 18.913
                        lon = 71.943
                        speed = 12.0
                        course = 165.0
                    else:  # Steaming away SE
                        lat = 18.913 - (i - 87) * 0.002
                        lon = 71.943 + (i - 87) * 0.002
                        speed = 12.0
                        course = 165.0

                elif v_idx == 1:  # MV PACIFIC VOYAGER — Straight transit through cone at 14 kn
                    # Passes steadily through the cone during the window
                    lat = 18.60 + i * 0.0035
                    lon = 71.70 + i * 0.0035
                    speed = 14.0  # Constant high speed
                    course = 45.0  # Constant course (std = 0)

                elif v_idx == 2:  # CHEM POLARIS — Edge clip (only 1 fix inside buffered cone)
                    lat = 18.70 + i * 0.002
                    if i == 65:
                        lat = 18.90
                        lon = 71.85  # safely inside buffer (71.83..71.88)
                    else:
                        lon = 71.78
                    speed = 10.0
                    course = 0.0

                elif v_idx == 3:  # Inside traffic bbox but outside origin cone
                    lat = 18.78 + i * 0.001
                    lon = 72.05  # within search bbox [71.78, 72.08], outside cone buffer [71.83, 72.03]
                    speed = 11.0
                    course = 0.0

                elif v_idx == 4:  # Inside traffic bbox but outside origin cone
                    lat = 19.03 - i * 0.001
                    lon = 71.80  # within search bbox, outside cone buffer
                    speed = 12.0
                    course = 180.0

                else:
                    # Other vessels will be dynamically reconstructed with accurate timestamps per spill region
                    continue

                track = AISTrack(
                    vessel_id=vessel.id,
                    base_datetime=t,
                    lat=round(lat, 6),
                    lon=round(lon, 6),
                    sog=round(max(0, speed), 1),
                    cog=round(course % 360, 1),
                    heading=round(course % 360, 1),
                    nav_status="Under way using engine",
                )
                db.add(track)
        
        await db.flush()
        print("[OK] Created AIS track points for all vessels")

        # ============ DRIFT SIMULATIONS ============
        for s_idx, sp in enumerate(spills):
            s_lat, s_lon = sp.centroid_lat, sp.centroid_lon
            cone_poly = {
                "type": "Polygon",
                "coordinates": [[
                    [round(s_lon - 0.05, 4), round(s_lat - 0.04, 4)],
                    [round(s_lon + 0.05, 4), round(s_lat - 0.04, 4)],
                    [round(s_lon + 0.06, 4), round(s_lat + 0.06, 4)],
                    [round(s_lon - 0.04, 4), round(s_lat + 0.06, 4)],
                    [round(s_lon - 0.05, 4), round(s_lat - 0.04, 4)]
                ]]
            }
            backward_traj = [
                {"time": (spill_time - timedelta(hours=h)).isoformat(),
                 "lat": round(s_lat + h * 0.006, 6),
                 "lon": round(s_lon + h * 0.005, 6),
                 "probability": round(max(0.1, 1 - h * 0.035), 3)}
                for h in range(0, 25)
            ]
            forward_traj = [
                {"time": (spill_time + timedelta(hours=h)).isoformat(),
                 "lat": round(s_lat - h * 0.005, 6),
                 "lon": round(s_lon - h * 0.004, 6),
                 "probability": round(max(0.1, 1 - h * 0.018), 3)}
                for h in range(0, 49)
            ]
            db.add(DriftSimulation(
                spill_id=sp.id, direction="backward",
                sim_start_time=spill_time - timedelta(hours=24),
                sim_end_time=spill_time, duration_hours=24,
                trajectory_points=backward_traj,
                parameters={
                    "method": "rk4_advection",
                    "current_speed": 0.25,
                    "wind_speed": 6.0,
                    "cone_geojson": cone_poly,
                    "origin_heatmap": {
                        "peak": {"lat": round(s_lat + 0.04, 4), "lon": round(s_lon + 0.03, 4), "density": 0.95},
                        "likely_radius_nm": 4.5,
                    }
                },
            ))
            db.add(DriftSimulation(
                spill_id=sp.id, direction="forward",
                sim_start_time=spill_time,
                sim_end_time=spill_time + timedelta(hours=48),
                duration_hours=48,
                trajectory_points=forward_traj,
                parameters={"method": "rk4_advection", "current_speed": 0.25, "wind_speed": 6.0},
            ))
        await db.flush()
        print(f"[OK] Created drift simulations for all {len(spills)} spills")

        # ============ SUSPECT SCORES & ANOMALIES (evaluated via attribution service) ============
        from app.attribution.service import evaluate_spill_suspects
        for sp in spills:
            if sp.validation_status == "lookalike":
                continue  # Natural lookalikes do not correlate with criminal vessel discharges
            try:
                await evaluate_spill_suspects(sp, db, top_n=3)
                print(f"[OK] Evaluated suspects and populated anomaly flags for {sp.name} (#{sp.id})")
            except Exception as e:
                print(f"[WARN] Attribution run for {sp.name}: {e}")

        # ============ IMPACT ASSESSMENTS (Geospatial & Economic Loss Valuation) ============
        from app.impact.service import assess_spill_environmental_impact
        from app.attribution.models import AnomalyFlag

        for sp in spills:
            gis_res = assess_spill_environmental_impact(
                sp.centroid_lat, sp.centroid_lon,
                area_sq_km=sp.area_sq_km,
                slick_geojson=sp.slick_geojson
            )
            econ = gis_res.get("economic_loss", {})
            nat = gis_res.get("natural_harm", {})
            imp = ImpactAssessment(
                spill_id=sp.id,
                affected_area_sq_km=gis_res["affected_area_sq_km"],
                coast_proximity_km=gis_res["coast_proximity_km"],
                overlaps_mpa=gis_res["overlaps_mpa"],
                overlaps_coral=gis_res["overlaps_coral"],
                overlaps_eez=gis_res["overlaps_eez"],
                nearest_mpa_name=gis_res["nearest_mpa_name"],
                nearest_mpa_distance_km=gis_res["nearest_mpa_distance_km"],
                priority=gis_res["priority"],
                estimated_cleanup_cost_usd=gis_res["estimated_cleanup_cost_usd"],
                ecological_sensitivity_score=gis_res["ecological_sensitivity_score"],
                affected_regions=[sp.region],
                vulnerability_details=gis_res["vulnerability_details"],
                commercial_loss_usd=econ.get("total_commercial_loss_usd"),
                fisheries_loss_usd=econ.get("fisheries_loss_usd"),
                port_trade_loss_usd=econ.get("port_trade_loss_usd"),
                tourism_loss_usd=econ.get("tourism_loss_usd"),
                natural_loss_index=nat.get("ecological_sensitivity_score"),
                coral_reef_risk=nat.get("coral_reef_risk"),
                mangrove_risk=nat.get("mangrove_risk"),
                endangered_species_threat=nat.get("endangered_species"),
            )
            db.add(imp)

            # High-priority Coast Guard notification for MPA/coastal proximity emergency
            if gis_res.get("is_proximity_emergency") and gis_res.get("emergency_alert"):
                db.add(AnomalyFlag(
                    vessel_id=None,
                    spill_id=sp.id,
                    anomaly_type="ecological_proximity_alert",
                    detected_at=sp.detected_at,
                    value=gis_res["nearest_mpa_distance_km"],
                    threshold=15.0,
                    description=gis_res["emergency_alert"][:500],
                    acknowledged=False,
                ))

        await db.flush()
        print(f"[OK] Created GIS-driven impact assessments and proximity alerts for all {len(spills)} spills")

        await db.commit()
        print("\n[SUCCESS] Demo data seeded successfully!")
        print("\n[INFO] Login credentials (all passwords: demo123):")
        print("   Public:           public_user")
        print("   Coast Guard:      coast_guard")
        print("   Regional Manager: regional_mgr")
        print("   Higher Authority: authority")


if __name__ == "__main__":
    import sys
    do_reset = "--reset" in sys.argv
    asyncio.run(seed(reset=do_reset))
