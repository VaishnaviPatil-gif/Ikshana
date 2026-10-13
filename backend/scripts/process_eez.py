"""
EEZ Boundary Processor
Extracts India's Exclusive Economic Zone (EEZ) from the global Marine Regions dataset
and outputs a clean, lightweight GeoJSON for the frontend map and impact module.

Usage:
  1. Put your downloaded EEZ .gpkg (or shapefile .zip) in:
     backend/data/gis/eez_raw/

  2. Run:
     python -m scripts.process_eez

  3. Generates:
     backend/data/gis/eez/india_eez.geojson
"""

import os
import sys
import argparse
from pathlib import Path
import geopandas as gpd

# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DEFAULT_INPUT_DIR = Path("data/gis/eez_raw")
DEFAULT_OUTPUT_FILE = Path("data/gis/eez/india_eez.geojson")


def extract_india_eez(input_path: str, output_file: str, simplify_deg: float = 0.005):
    in_path = Path(input_path)
    out_path = Path(output_file)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    files = []
    if in_path.is_file():
        files = [in_path]
    elif in_path.is_dir():
        files = list(in_path.glob("**/*.gpkg")) + list(in_path.glob("**/*.shp")) + list(in_path.glob("**/*.geojson"))
    else:
        print(f"[ERROR] Path does not exist: {input_path}")
        return

    if not files:
        print(f"[!] No .gpkg or .shp files found in {input_path}")
        print(f"    Please place your downloaded file in: {in_path.resolve()}")
        return

    # Prioritize polygon dataset (eez_v12.gpkg) over line boundaries
    target_file = next((f for f in files if "boundaries" not in f.name.lower() and "eez" in f.name.lower()), files[0])
    print(f"[*] Reading global EEZ dataset from: {target_file.name} ({target_file.stat().st_size / (1024*1024):.1f} MB)...")

    try:
        gdf = gpd.read_file(target_file)
    except Exception as e:
        print(f"[ERROR] Failed to read spatial file: {e}")
        return

    print(f"[*] Loaded {len(gdf)} global maritime boundaries.")

    # Search for India across standard Marine Regions attribute columns
    india_mask = None
    for col in ["SOVEREIGN1", "TERRITORY1", "GEONAME", "SOVEREIGN", "NAME"]:
        if col in gdf.columns:
            mask = gdf[col].astype(str).str.contains("India", case=False, na=False)
            india_mask = mask if india_mask is None else (india_mask | mask)

    if india_mask is None or not india_mask.any():
        print("[!] Could not find 'India' using standard columns. Available columns:", list(gdf.columns))
        return

    india_gdf = gdf[india_mask].copy()
    print(f"[OK] Found {len(india_gdf)} maritime zone(s) belonging to India.")

    # Reproject to WGS84 standard
    if india_gdf.crs is None:
        india_gdf = india_gdf.set_crs(epsg=4326)
    elif india_gdf.crs.to_epsg() != 4326:
        india_gdf = india_gdf.to_crs(epsg=4326)

    # Simplify slightly for fast vector rendering on web map
    if simplify_deg > 0:
        print(f"[*] Simplifying boundary for optimal web performance (tolerance={simplify_deg}°)...")
        india_gdf["geometry"] = india_gdf["geometry"].simplify(simplify_deg, preserve_topology=True)

    # Keep essential columns
    keep_cols = [c for c in ["GEONAME", "SOVEREIGN1", "TERRITORY1", "AREA_KM2", "geometry"] if c in india_gdf.columns]
    if keep_cols:
        india_gdf = india_gdf[keep_cols]

    india_gdf.to_file(out_path, driver="GeoJSON")
    size_kb = out_path.stat().st_size / 1024
    print(f"\n[SUCCESS] Extracted India EEZ boundary -> {out_path} ({size_kb:.1f} KB)")
    print(f"          Ready for legal boundary display and overlap checks!\n")


def main():
    parser = argparse.ArgumentParser(description="Extract India EEZ from Marine Regions dataset")
    parser.add_argument("--input", "-i", type=str, default="data/gis/eez_raw",
                        help="Input .gpkg or folder")
    parser.add_argument("--output", "-o", type=str, default="data/gis/eez/india_eez.geojson",
                        help="Output GeoJSON path")
    parser.add_argument("--simplify", type=float, default=0.005,
                        help="Simplification tolerance (degrees)")

    args = parser.parse_args()
    extract_india_eez(args.input, args.output, args.simplify)


if __name__ == "__main__":
    main()
