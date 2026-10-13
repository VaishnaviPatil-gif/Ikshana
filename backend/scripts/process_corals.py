"""
Coral Reef Processor & Merger
Merges multiple Allen Coral Atlas .gpkg files (e.g. Reef-Extent) into a single,
clean GeoJSON dataset for oil spill ecological impact assessment.

Usage:
  1. Put your 3 .gpkg files into:
     backend/data/gis/corals_raw/

  2. Run the script:
     python -m scripts.process_corals

  3. Output will be generated at:
     backend/data/gis/corals/coral_reefs.geojson
"""

import os
import sys
import argparse
from pathlib import Path
import pandas as pd
import geopandas as gpd

# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DEFAULT_INPUT_DIR = Path("data/gis/corals_raw")
DEFAULT_OUTPUT_FILE = Path("data/gis/corals/coral_reefs.geojson")


def process_corals(input_path: str, output_file: str, simplify_deg: float = 0.0005):
    in_path = Path(input_path)
    out_path = Path(output_file)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    gpkg_files = []
    if in_path.is_file():
        gpkg_files = [in_path]
    elif in_path.is_dir():
        # Find all .gpkg files recursively
        gpkg_files = list(in_path.glob("**/*.gpkg"))
        if not gpkg_files:
            # Also check for shapefiles or geojson if present
            gpkg_files = list(in_path.glob("**/*.shp")) + list(in_path.glob("**/*.geojson"))
    else:
        print(f"[ERROR] Input path does not exist: {input_path}")
        return

    if not gpkg_files:
        print(f"[!] No .gpkg or spatial files found in {input_path}")
        print(f"    Please place your 3 .gpkg files inside: {input_path.resolve()}")
        return

    print(f"\n[*] Found {len(gpkg_files)} dataset file(s) to process:")
    for f in gpkg_files:
        print(f"    - {f.name} ({f.stat().st_size / (1024*1024):.2f} MB)")

    gdfs = []
    for f in gpkg_files:
        print(f"[*] Reading {f.name}...")
        try:
            gdf = gpd.read_file(f)
            # Ensure standard WGS84 coordinates (lat/lon)
            if gdf.crs is None:
                gdf = gdf.set_crs(epsg=4326)
            elif gdf.crs.to_epsg() != 4326:
                gdf = gdf.to_crs(epsg=4326)

            # Keep only necessary geometry and attribute info
            gdf["source_file"] = f.stem
            gdfs.append(gdf)
            print(f"    Loaded {len(gdf)} features from {f.name}")
        except Exception as e:
            print(f"[WARN] Failed to read {f}: {e}")

    if not gdfs:
        print("[ERROR] No valid data could be read.")
        return

    print("[*] Merging all coral reef datasets together...")
    merged_gdf = pd.concat(gdfs, ignore_index=True)
    merged_gdf = gpd.GeoDataFrame(merged_gdf, crs="EPSG:4326")

    total_count = len(merged_gdf)
    bounds = merged_gdf.total_bounds  # [minx, miny, maxx, maxy]
    print(f"[OK] Total merged reef polygons: {total_count}")
    print(f"     Bounding Box: Lon [{bounds[0]:.2f}, {bounds[2]:.2f}], Lat [{bounds[1]:.2f}, {bounds[3]:.2f}]")

    # Optional geometry simplification for high-speed collision detection and web rendering
    if simplify_deg > 0:
        print(f"[*] Optimizing geometry (tolerance={simplify_deg}°)...")
        merged_gdf["geometry"] = merged_gdf["geometry"].simplify(simplify_deg, preserve_topology=True)

    print(f"[*] Saving unified GeoJSON to: {out_path}...")
    merged_gdf.to_file(out_path, driver="GeoJSON")
    file_size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"[SUCCESS] Coral reef layer saved! File size: {file_size_mb:.2f} MB")
    print(f"          Ready for use in impact assessment.\n")


def main():
    parser = argparse.ArgumentParser(description="Process and merge Allen Coral Atlas .gpkg files into GeoJSON")
    parser.add_argument("--input", "-i", type=str, default="data/gis/corals_raw",
                        help="Folder containing .gpkg files (or path to a single .gpkg)")
    parser.add_argument("--output", "-o", type=str, default="data/gis/corals/coral_reefs.geojson",
                        help="Output GeoJSON path")
    parser.add_argument("--simplify", type=float, default=0.0005,
                        help="Geometry simplification tolerance in degrees (0 to disable)")

    args = parser.parse_args()
    process_corals(args.input, args.output, args.simplify)


if __name__ == "__main__":
    main()
