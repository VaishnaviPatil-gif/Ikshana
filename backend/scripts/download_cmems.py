"""
Copernicus Marine (CMEMS) Ocean Currents Downloader
Downloads ocean current vectors (uo = eastward, vo = northward) for Indian waters.

Usage:
  1. Make sure you logged in:
     python -m scripts.download_cmems --login

  2. Download ocean currents for Indian waters:
     python -m scripts.download_cmems
"""

import os
import sys
import argparse
from pathlib import Path

# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import copernicusmarine

OUTPUT_DIR = Path("data/cmems")
OUTPUT_FILE = "currents_india.nc"
DATASET_ID = "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m"


def login():
    print("\n[*] Copernicus Marine Login")
    print("    Enter your Copernicus Marine account credentials:")
    copernicusmarine.login()


def download_currents(
    start_date: str = "2024-01-01",
    end_date: str = "2024-01-07",
    min_lon: float = 68.0,
    max_lon: float = 89.0,
    min_lat: float = 6.0,
    max_lat: float = 24.0,
    out_dir: str = str(OUTPUT_DIR),
    out_file: str = OUTPUT_FILE
):
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    print(f"\n========================================================")
    print(f"  CMEMS Ocean Current Downloader")
    print(f"  Dataset: {DATASET_ID}")
    print(f"  Variables: uo (eastward), vo (northward)")
    print(f"  Bounds: Lon [{min_lon}, {max_lon}], Lat [{min_lat}, {max_lat}]")
    print(f"  Dates: {start_date} to {end_date}")
    print(f"  Output: {out_path / out_file}")
    print(f"========================================================\n")

    try:
        copernicusmarine.subset(
            dataset_id=DATASET_ID,
            variables=["uo", "vo"],
            minimum_longitude=min_lon,
            maximum_longitude=max_lon,
            minimum_latitude=min_lat,
            maximum_latitude=max_lat,
            start_datetime=start_date,
            end_datetime=end_date,
            output_directory=out_path,
            output_filename=out_file,
            overwrite=True
        )
        print(f"\n[SUCCESS] Downloaded ocean currents -> {out_path / out_file}\n")
    except Exception as e:
        print(f"\n[ERROR] Download failed: {e}")
        print("Tip: If not logged in, run: python -m scripts.download_cmems --login\n")


def main():
    parser = argparse.ArgumentParser(description="Download Copernicus Marine currents for India")
    parser.add_argument("--login", action="store_true", help="Login to Copernicus Marine")
    parser.add_argument("--start", type=str, default="2024-01-01", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", type=str, default="2024-01-07", help="End date (YYYY-MM-DD)")

    args = parser.parse_args()
    if args.login:
        login()
    else:
        download_currents(start_date=args.start, end_date=args.end)


if __name__ == "__main__":
    main()
