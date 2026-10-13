"""
Live AIS ingestion service using aisstream.io WebSocket API.
Streams real-time vessel positions and static metadata directly into the database.

Usage:
  1. Configure your API key in backend/.env:
     AISSTREAM_API_KEY=your_actual_key_here

  2. Run the streamer:
     python -m scripts.stream_ais

  3. Filter by specific region:
     python -m scripts.stream_ais --region west_coast
     python -m scripts.stream_ais --region mumbai
     python -m scripts.stream_ais --region east_coast
     python -m scripts.stream_ais --region national

  4. Test run without saving:
     python -m scripts.stream_ais --dry-run --max-messages 50
"""

import os
import sys
import json
import argparse
import asyncio
from datetime import datetime, timezone

# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.database import async_session
from app.vessels.models import Vessel, AISTrack
from sqlalchemy import select

try:
    import websockets
except ImportError:
    print("[ERROR] 'websockets' package is required. Install it using: pip install websockets")
    sys.exit(1)


# Bounding boxes for aisstream.io API format:
# [ [ [TopLeft_Lat (North), TopLeft_Lon (West)], [BottomRight_Lat (South), BottomRight_Lon (East)] ] ]
BOUNDING_BOXES = {
    # Expanded India & Surroundings (Arabian Sea, Bay of Bengal, Sri Lanka, Maldives, Andaman & Nicobar, and international crude tanker routes)
    "national": [[[27.0, 58.0], [-2.0, 98.0]]],
    "india_mainland": [[[25.0, 68.0], [6.0, 89.0]]],
    "west_coast": [[[24.0, 65.0], [8.0, 77.0]]],
    "mumbai": [[[21.0, 70.0], [17.0, 74.0]]],
    "east_coast": [[[22.5, 79.0], [10.0, 89.0]]],
    "andaman": [[[15.0, 90.0], [6.0, 96.0]]],
    "arabian_sea": [[[26.0, 58.0], [5.0, 77.5]]],
    "bay_of_bengal": [[[23.5, 79.0], [5.0, 98.0]]],
}

# Maritime Identification Digits (MID) lookup for vessel flag country
MID_LOOKUP = {
    "419": ("India", "🇮🇳"),
    "417": ("Sri Lanka", "🇱🇰"),
    "455": ("Maldives", "🇲🇻"),
    "405": ("Bangladesh", "🇧🇩"),
    "463": ("Pakistan", "🇵🇰"),
    "563": ("Singapore", "🇸🇬"),
    "564": ("Singapore", "🇸🇬"),
    "565": ("Singapore", "🇸🇬"),
    "566": ("Singapore", "🇸🇬"),
    "351": ("Panama", "🇵🇦"),
    "352": ("Panama", "🇵🇦"),
    "353": ("Panama", "🇵🇦"),
    "354": ("Panama", "🇵🇦"),
    "355": ("Panama", "🇵🇦"),
    "356": ("Panama", "🇵🇦"),
    "357": ("Panama", "🇵🇦"),
    "636": ("Liberia", "🇱🇷"),
    "538": ("Marshall Is.", "🇲🇭"),
    "220": ("Denmark", "🇩🇰"),
    "440": ("Korea", "🇰🇷"),
    "441": ("Korea", "🇰🇷"),
    "412": ("China", "🇨🇳"),
    "413": ("China", "🇨🇳"),
    "414": ("China", "🇨🇳"),
    "370": ("Panama", "🇵🇦"),
    "371": ("Panama", "🇵🇦"),
    "372": ("Panama", "🇵🇦"),
    "229": ("Malta", "🇲🇹"),
    "248": ("Malta", "🇲🇹"),
    "249": ("Malta", "🇲🇹"),
    "255": ("Portugal", "🇵🇹"),
    "256": ("Malta", "🇲🇹"),
    "311": ("Bahamas", "🇧🇸"),
    "308": ("Bahamas", "🇧🇸"),
    "309": ("Bahamas", "🇧🇸"),
    "538": ("Marshall Is.", "🇲🇭"),
    "636": ("Liberia", "🇱🇷"),
}


def resolve_flag_state(mmsi_str: str) -> tuple:
    """Returns (country_name, flag_icon) based on MMSI prefix."""
    if not mmsi_str or len(mmsi_str) < 3:
        return ("Unknown", "🌐")
    return MID_LOOKUP.get(mmsi_str[:3], ("International", "🚢"))


def describe_location(lat: float, lon: float) -> str:
    """Provides a human-readable maritime sub-region label for Indian & surrounding waters."""
    if lat > 20.0 and lon < 73.0:
        return "Gujarat / Gulf of Kutch"
    elif 17.0 <= lat <= 20.0 and 70.0 <= lon <= 74.0:
        return "Mumbai Offshore"
    elif 12.0 <= lat < 17.0 and lon < 75.0:
        return "Goa / Karwar Coast"
    elif 8.0 <= lat < 12.0 and lon < 77.0:
        return "Kerala / Cochin Waters"
    elif 8.0 <= lat <= 14.5 and 79.5 <= lon <= 83.0:
        return "Chennai / Tamil Nadu Coast"
    elif 14.5 < lat <= 19.0 and 81.0 <= lon <= 86.0:
        return "Andhra / Vizag Coast"
    elif lat > 19.0 and lon >= 86.0:
        return "Odisha / Bengal Coast"
    elif lon >= 91.0:
        return "Andaman & Nicobar Waters"
    elif lat < 8.0 and 78.0 <= lon <= 83.0:
        return "Sri Lanka / Gulf of Mannar"
    elif lat < 8.0 and lon < 78.0:
        return "Maldives / South Arabian Sea"
    elif lon < 68.0:
        return "Western Arabian Sea Corridor"
    elif lon > 88.0 and lat < 15.0:
        return "Bay of Bengal / Malacca Route"
    return "Indian Ocean"

# Standard IMO / ITU AIS ship type classification
SHIP_TYPE_LOOKUP = {
    range(20, 30): "WIG",
    range(30, 31): "Fishing",
    range(31, 33): "Towing",
    range(33, 34): "Dredging",
    range(35, 36): "Military",
    range(36, 38): "Pleasure / Sailing",
    range(40, 50): "High Speed Craft",
    range(50, 51): "Pilot",
    range(51, 52): "Search & Rescue",
    range(52, 53): "Tug",
    range(54, 55): "Anti-pollution",
    range(55, 56): "Law Enforcement",
    range(60, 70): "Passenger",
    range(70, 80): "Cargo",
    range(80, 90): "Tanker",
}

NAV_STATUS_LOOKUP = {
    0: "Under way using engine",
    1: "At anchor",
    2: "Not under command",
    3: "Restricted maneuverability",
    4: "Constrained by draught",
    5: "Moored",
    6: "Aground",
    7: "Engaged in fishing",
    8: "Under way sailing",
}


def resolve_vessel_type(type_code: int) -> str:
    if not type_code:
        return "Other"
    for r, label in SHIP_TYPE_LOOKUP.items():
        if type_code in r:
            return label
    return "Cargo" if 70 <= type_code <= 79 else "Tanker" if 80 <= type_code <= 89 else "Other"


def parse_timestamp(time_str: str) -> datetime:
    """Parse aisstream UTC timestamp formats."""
    if not time_str:
        return datetime.now(timezone.utc)
    try:
        # e.g., '2024-03-01 12:00:00.123456 +0000 UTC'
        cleaned = time_str.split(" +")[0].replace(" UTC", "")
        return datetime.fromisoformat(cleaned).replace(tzinfo=timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


class AISStreamIngestor:
    def __init__(self, api_key: str, region: str = "national", dry_run: bool = False, max_messages: int = 0):
        self.api_key = api_key
        self.region = region
        self.dry_run = dry_run
        self.max_messages = max_messages
        self.vessel_cache = {}  # mmsi -> vessel_id
        self.msg_count = 0
        self.track_count = 0

        # Calculate exact bounding coordinates
        self.bbox = BOUNDING_BOXES.get(self.region, BOUNDING_BOXES["national"])
        p1, p2 = self.bbox[0][0], self.bbox[0][1]
        self.min_lat = min(p1[0], p2[0])
        self.max_lat = max(p1[0], p2[0])
        self.min_lon = min(p1[1], p2[1])
        self.max_lon = max(p1[1], p2[1])

    async def get_or_create_vessel(self, db, mmsi_str: str, name: str = None, v_type: str = None, imo: str = None, call_sign: str = None):
        if mmsi_str in self.vessel_cache:
            return self.vessel_cache[mmsi_str]

        res = await db.execute(select(Vessel).where(Vessel.mmsi == mmsi_str))
        vessel = res.scalar_one_or_none()

        if not vessel:
            country, _ = resolve_flag_state(mmsi_str)
            vessel = Vessel(
                mmsi=mmsi_str,
                vessel_name=name or f"VESSEL-{mmsi_str}",
                vessel_type=v_type or "Tanker",
                imo=imo,
                call_sign=call_sign,
                flag_state=country
            )
            db.add(vessel)
            await db.flush()
            await db.refresh(vessel)
        else:
            # Update fields if new static info became available
            if name and (not vessel.vessel_name or vessel.vessel_name.startswith("VESSEL-")):
                vessel.vessel_name = name
            if v_type and vessel.vessel_type in [None, "Other"]:
                vessel.vessel_type = v_type
            if imo and not vessel.imo:
                vessel.imo = imo
            if call_sign and not vessel.call_sign:
                vessel.call_sign = call_sign
            if vessel.flag_state in [None, "Unknown"]:
                country, _ = resolve_flag_state(mmsi_str)
                vessel.flag_state = country
            await db.flush()

        self.vessel_cache[mmsi_str] = vessel.id
        return vessel.id

    async def process_position_report(self, db, meta: dict, pos: dict):
        mmsi_str = str(meta.get("MMSI")).strip()
        lat = meta.get("latitude")
        lon = meta.get("longitude")
        time_utc = meta.get("time_utc")

        if lat is None or lon is None:
            return

        # Strict geographic filter: only accept ships within India & surrounding waters
        if not (self.min_lat <= lat <= self.max_lat and self.min_lon <= lon <= self.max_lon):
            return

        ship_name = (meta.get("ShipName") or "").strip()
        sog = float(pos.get("Sog", 0.0))
        cog = float(pos.get("Cog", 0.0))
        heading = float(pos.get("TrueHeading", cog))
        nav_status_code = pos.get("NavigationalStatus", 0)
        nav_status = NAV_STATUS_LOOKUP.get(nav_status_code, "Under way")

        dt = parse_timestamp(time_utc)
        country, flag_icon = resolve_flag_state(mmsi_str)
        zone = describe_location(lat, lon)

        if self.dry_run:
            print(f"  [DRY-RUN] MMSI {mmsi_str:<9} | {ship_name[:16]:<16} | {flag_icon} {country:<12} | {zone:<26} | Lat {lat:>7.4f}, Lon {lon:>7.4f} | {sog:>4.1f} kn", flush=True)
            return

        vessel_id = await self.get_or_create_vessel(db, mmsi_str, name=ship_name)
        track = AISTrack(
            vessel_id=vessel_id,
            base_datetime=dt,
            lat=round(lat, 6),
            lon=round(lon, 6),
            sog=round(max(0.0, sog), 1),
            cog=round(cog % 360, 1),
            heading=round(heading % 360, 1),
            nav_status=nav_status
        )
        db.add(track)
        self.track_count += 1

        print(f"  [TRACK] MMSI {mmsi_str:<9} | {ship_name[:16]:<16} | {flag_icon} {country:<12} | {zone:<26} | Lat {lat:>7.4f}, Lon {lon:>7.4f} | {sog:>4.1f} kn", flush=True)

    async def process_static_data(self, db, meta: dict, static: dict):
        mmsi_str = str(meta.get("MMSI")).strip()
        lat = meta.get("latitude")
        lon = meta.get("longitude")

        # Discard static data outside our regional bounding box
        if lat is not None and lon is not None:
            if not (self.min_lat <= lat <= self.max_lat and self.min_lon <= lon <= self.max_lon):
                return
        elif mmsi_str not in self.vessel_cache:
            # If coordinates are omitted and vessel not yet seen in our area, skip
            return

        name = (static.get("Name") or meta.get("ShipName") or "").strip()
        imo = str(static.get("ImoNumber", "")) if static.get("ImoNumber") else None
        call_sign = (static.get("CallSign") or "").strip() or None
        type_code = static.get("Type", 0)
        v_type = resolve_vessel_type(type_code)
        country, flag_icon = resolve_flag_state(mmsi_str)

        if self.dry_run:
            print(f"  [DRY-RUN] Static: MMSI {mmsi_str} | Name: {name} | {flag_icon} {country} | Type: {v_type} | IMO: {imo or 'N/A'}", flush=True)
            return

        await self.get_or_create_vessel(db, mmsi_str, name=name, v_type=v_type, imo=imo, call_sign=call_sign)
        print(f"  [VESSEL INFO] MMSI {mmsi_str} -> {name} ({v_type}) | {flag_icon} {country} | IMO: {imo or 'N/A'}", flush=True)

    async def run(self):
        ws_url = "wss://stream.aisstream.io/v0/stream"
        bbox = BOUNDING_BOXES.get(self.region, BOUNDING_BOXES["national"])

        subscribe_message = {
            "APIKey": self.api_key,
            "BoundingBoxes": bbox,
            "FilterMessageTypes": ["PositionReport", "ShipStaticData"]
        }

        print(f"\n========================================================", flush=True)
        print(f"  AISStream Live Ingestion Engine", flush=True)
        print(f"  Region: {self.region} (BBox: {bbox[0]})", flush=True)
        print(f"  Dry-run Mode: {self.dry_run}", flush=True)
        print(f"  Target: {'SQLite (oilspill.db)' if 'sqlite' in settings.DATABASE_URL else 'PostgreSQL'}", flush=True)
        print(f"========================================================\n", flush=True)
        print(f"[*] Connecting to {ws_url}...", flush=True)

        backoff = 2
        while True:
            try:
                async with websockets.connect(ws_url, ping_interval=20, ping_timeout=20) as ws:
                    print("[OK] Connected to aisstream.io! Subscribing to vessel stream...", flush=True)
                    await ws.send(json.dumps(subscribe_message))
                    backoff = 2  # reset backoff on successful connection

                    db_context = None if self.dry_run else async_session()
                    db = None if self.dry_run else await db_context.__aenter__()
                    batch_counter = 0

                    try:
                        async for raw_message in ws:
                            self.msg_count += 1
                            try:
                                msg = json.loads(raw_message)
                            except Exception:
                                continue

                            msg_type = msg.get("MessageType")
                            meta = msg.get("MetaData", {})
                            body = msg.get("Message", {})

                            if msg_type == "PositionReport":
                                await self.process_position_report(db, meta, body.get("PositionReport", {}))
                            elif msg_type == "ShipStaticData":
                                await self.process_static_data(db, meta, body.get("ShipStaticData", {}))

                            batch_counter += 1
                            if not self.dry_run and batch_counter >= 10:
                                await db.commit()
                                batch_counter = 0

                            if self.max_messages > 0 and self.msg_count >= self.max_messages:
                                if not self.dry_run:
                                    await db.commit()
                                print(f"\n[DONE] Reached max messages limit ({self.max_messages}). Stopping.", flush=True)
                                return
                    finally:
                        if db_context and db:
                            await db_context.__aexit__(None, None, None)

            except (websockets.exceptions.ConnectionClosed, asyncio.TimeoutError, ConnectionError) as e:
                print(f"[!] Connection dropped ({e}). Reconnecting in {backoff}s...", flush=True)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60)
            except Exception as e:
                print(f"[ERROR] Unexpected streaming error: {e}", flush=True)
                await asyncio.sleep(5)


def main():
    parser = argparse.ArgumentParser(description="Live AIS Streamer from aisstream.io into Database")
    parser.add_argument("--api-key", type=str, help="aisstream.io API key (or set AISSTREAM_API_KEY in backend/.env)")
    parser.add_argument("--region", type=str, default="national",
                        choices=["national", "india_mainland", "west_coast", "mumbai", "east_coast", "andaman", "arabian_sea", "bay_of_bengal"],
                        help="Geographic bounding box preset")
    parser.add_argument("--dry-run", action="store_true", help="Print messages without writing to database")
    parser.add_argument("--max-messages", type=int, default=0, help="Stop after receiving N messages (0 for continuous)")

    args = parser.parse_args()

    api_key = args.api_key or settings.AISSTREAM_API_KEY or os.environ.get("AISSTREAM_API_KEY")

    if not api_key:
        print("\n[ERROR] No aisstream.io API key found!")
        print("Please do one of the following:")
        print("  1. Add your key to 'backend/.env':")
        print("     AISSTREAM_API_KEY=your_actual_key_here")
        print("  2. Or pass it directly via CLI:")
        print("     python -m scripts.stream_ais --api-key YOUR_KEY\n")
        sys.exit(1)

    ingestor = AISStreamIngestor(
        api_key=api_key,
        region=args.region,
        dry_run=args.dry_run,
        max_messages=args.max_messages
    )

    try:
        asyncio.run(ingestor.run())
    except KeyboardInterrupt:
        print(f"\n[STOPPED] AIS stream stopped by user. Total tracks recorded: {ingestor.track_count}")


if __name__ == "__main__":
    main()
