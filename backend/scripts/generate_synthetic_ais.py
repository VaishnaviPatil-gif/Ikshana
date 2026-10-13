"""
Synthetic AIS data generator for demo purposes.
Generates realistic vessel traffic matching the AIS schema, with one "suspect" vessel
that has deliberately planted anomalies (AIS gap + speed drop) near the demo spill time.

Schema: MMSI, BaseDateTime, LAT, LON, SOG, COG, Heading, VesselName, IMO, CallSign,
        VesselType, Status, Length, Width, Draft, Cargo
"""
import csv
import os
import random
import numpy as np
from datetime import datetime, timedelta, timezone
from math import radians, degrees, sin, cos, atan2, sqrt


# Demo spill location: Arabian Sea, off Mumbai coast
SPILL_LAT = 18.85
SPILL_LON = 71.90
SPILL_TIME = datetime(2024, 3, 15, 6, 0, 0, tzinfo=timezone.utc)

# Vessel templates
VESSEL_TEMPLATES = [
    {
        "mmsi": "419001001", "name": "MT ARABIAN STAR", "imo": "9801001",
        "call_sign": "VJAA", "type": "Tanker", "length": 250, "width": 44,
        "draft": 14.5, "flag": "India", "is_suspect": True,
    },
    {
        "mmsi": "419002002", "name": "MV OCEAN PRIDE", "imo": "9801002",
        "call_sign": "VJBB", "type": "Cargo", "length": 180, "width": 28,
        "draft": 10.2, "flag": "India", "is_suspect": False,
    },
    {
        "mmsi": "419003003", "name": "MV MUMBAI EXPRESS", "imo": "9801003",
        "call_sign": "VJCC", "type": "Container", "length": 300, "width": 48,
        "draft": 13.0, "flag": "India", "is_suspect": False,
    },
    {
        "mmsi": "419004004", "name": "FV SAGAR MITRA", "imo": "",
        "call_sign": "VJDD", "type": "Fishing", "length": 25, "width": 7,
        "draft": 3.5, "flag": "India", "is_suspect": False,
    },
    {
        "mmsi": "419005005", "name": "MT CRUDE CARRIER", "imo": "9801005",
        "call_sign": "VJEE", "type": "Tanker", "length": 280, "width": 50,
        "draft": 16.0, "flag": "India", "is_suspect": False,
    },
    {
        "mmsi": "538006006", "name": "MV SEA DRAGON", "imo": "9801006",
        "call_sign": "V7AA", "type": "Cargo", "length": 190, "width": 30,
        "draft": 11.0, "flag": "Marshall Islands", "is_suspect": False,
    },
    {
        "mmsi": "636007007", "name": "MV LIBERIA STAR", "imo": "9801007",
        "call_sign": "ELAA", "type": "Tanker", "length": 220, "width": 38,
        "draft": 13.5, "flag": "Liberia", "is_suspect": False,
    },
    {
        "mmsi": "419008008", "name": "TUG SAMRAT", "imo": "",
        "call_sign": "VJFF", "type": "Tug", "length": 35, "width": 10,
        "draft": 4.0, "flag": "India", "is_suspect": False,
    },
]


def generate_vessel_track(vessel, spill_time, duration_hours=48, interval_minutes=5):
    """Generate a realistic AIS track for one vessel."""
    records = []
    
    # Random starting position in the wider area
    base_lat = SPILL_LAT + random.uniform(-0.5, 0.5)
    base_lon = SPILL_LON + random.uniform(-0.5, 0.5)
    
    # Random course and speed
    if vessel["type"] == "Fishing":
        base_speed = random.uniform(3, 7)
        base_course = random.uniform(0, 360)
    elif vessel["type"] == "Tanker":
        base_speed = random.uniform(10, 14)
        base_course = random.uniform(180, 270)  # Generally heading south/west
    else:
        base_speed = random.uniform(12, 18)
        base_course = random.uniform(0, 360)
    
    start_time = spill_time - timedelta(hours=duration_hours / 2)
    num_points = int(duration_hours * 60 / interval_minutes)
    
    lat, lon = base_lat, base_lon
    speed = base_speed
    course = base_course
    
    for i in range(num_points):
        current_time = start_time + timedelta(minutes=i * interval_minutes)
        
        # === SUSPECT VESSEL: planted anomalies ===
        if vessel.get("is_suspect"):
            hours_from_spill = (current_time - spill_time).total_seconds() / 3600
            
            # AIS GAP: skip records for 2 hours before spill
            if -3 <= hours_from_spill <= -1:
                continue  # No AIS data — gap!
            
            # SPEED DROP: slow down near spill time
            if -1 < hours_from_spill <= 0.5:
                speed = random.uniform(0.5, 2.0)  # Near-stop
                # Move toward spill location
                lat += (SPILL_LAT - lat) * 0.1
                lon += (SPILL_LON - lon) * 0.1
            
            # COURSE CHANGE: after spill, change course dramatically
            if 0.5 < hours_from_spill <= 1:
                course = (base_course + 120 + random.uniform(-10, 10)) % 360
                speed = random.uniform(14, 16)  # Speed up to flee
            
            # Back to normal later
            if hours_from_spill > 2:
                speed = base_speed + random.uniform(-1, 1)
                course = base_course + random.uniform(-5, 5)
        
        # Normal movement with slight variation
        speed += random.uniform(-0.3, 0.3)
        speed = max(0.5, speed)
        course += random.uniform(-2, 2)
        course = course % 360
        
        # Advance position
        meters_per_deg_lat = 111320
        meters_per_deg_lon = 111320 * cos(radians(lat))
        speed_ms = speed * 0.5144  # knots to m/s
        distance_m = speed_ms * interval_minutes * 60
        
        lat += (distance_m * cos(radians(course))) / meters_per_deg_lat
        lon += (distance_m * sin(radians(course))) / meters_per_deg_lon
        
        heading = course + random.uniform(-5, 5)
        heading = heading % 360
        
        records.append({
            "MMSI": vessel["mmsi"],
            "BaseDateTime": current_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "LAT": round(lat, 6),
            "LON": round(lon, 6),
            "SOG": round(speed, 1),
            "COG": round(course, 1),
            "Heading": round(heading, 1),
            "VesselName": vessel["name"],
            "IMO": vessel.get("imo", ""),
            "CallSign": vessel.get("call_sign", ""),
            "VesselType": vessel["type"],
            "Status": "Under way using engine",
            "Length": vessel["length"],
            "Width": vessel["width"],
            "Draft": vessel["draft"],
            "Cargo": "Crude Oil" if vessel["type"] == "Tanker" else "General",
        })
    
    return records


def generate_synthetic_ais(output_path=None, duration_hours=48):
    """Generate full synthetic AIS dataset with planted anomalies."""
    if output_path is None:
        output_path = os.path.join("data", "ais", "synthetic_ais.csv")
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    all_records = []
    for vessel in VESSEL_TEMPLATES:
        track = generate_vessel_track(vessel, SPILL_TIME, duration_hours)
        all_records.extend(track)
    
    # Sort by time
    all_records.sort(key=lambda r: r["BaseDateTime"])
    
    # Write CSV
    fieldnames = [
        "MMSI", "BaseDateTime", "LAT", "LON", "SOG", "COG", "Heading",
        "VesselName", "IMO", "CallSign", "VesselType", "Status",
        "Length", "Width", "Draft", "Cargo"
    ]
    
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_records)
    
    print(f"Generated {len(all_records)} AIS records for {len(VESSEL_TEMPLATES)} vessels")
    print(f"Saved to: {output_path}")
    print(f"Suspect vessel: {VESSEL_TEMPLATES[0]['name']} ({VESSEL_TEMPLATES[0]['mmsi']})")
    print(f"Planted anomalies: AIS gap (T-3h to T-1h), speed drop (T-1h to T+0.5h), course change (T+0.5h)")
    
    return output_path


if __name__ == "__main__":
    generate_synthetic_ais()
