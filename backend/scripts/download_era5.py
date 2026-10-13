"""
ERA5 Wind Data Downloader using Copernicus Climate Data Store (CDS) API.
Downloads 10m surface wind components (u10 = eastward, v10 = northward) for Indian waters.

Usage:
  1. Add your CDS API Key to backend/.env:
     CDS_API_KEY=your_personal_access_token_here

  2. Run the downloader:
     python -m scripts.download_era5
"""

import os
import sys
import argparse
from pathlib import Path

# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings

OUTPUT_DIR = Path("data/era5")
OUTPUT_FILE = "era5_wind_india.nc"


def setup_cdsapirc(api_key: str):
    """Ensure ~/.cdsapirc exists on Windows so cdsapi works out of the box."""
    home_dir = Path.home()
    rc_file = home_dir / ".cdsapirc"
    content = f"url: https://cds.climate.copernicus.eu/api\nkey: {api_key}\n"
    rc_file.write_text(content, encoding="utf-8")
    print(f"[*] Configured CDS credentials in: {rc_file}")


def download_era5(
    api_key: str = None,
    year: str = "2024",
    month: str = "01",
    days: list = None,
    out_dir: str = str(OUTPUT_DIR),
    out_file: str = OUTPUT_FILE
):
    key = api_key or settings.CDS_API_KEY or os.environ.get("CDS_API_KEY")
    if not key:
        print("\n[ERROR] No Copernicus CDS API key found!")
        print("Please do one of the following:")
        print("  1. Add your key to 'backend/.env':")
        print("     CDS_API_KEY=your_personal_access_token_here")
        print("  2. Or pass it directly via CLI:")
        print("     python -m scripts.download_era5 --key YOUR_KEY\n")
        print("How to get it:")
        print("  Go to https://cds.climate.copernicus.eu/how-to-api and copy your Personal Access Token.\n")
        sys.exit(1)

    setup_cdsapirc(key)

    import cdsapi
    client = cdsapi.Client()

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    target_nc = out_path / out_file

    if not days:
        days = ["01", "02", "03", "04", "05"]

    print(f"\n========================================================")
    print(f"  ERA5 Surface Wind Downloader (Copernicus CDS)")
    print(f"  Dataset: reanalysis-era5-single-levels")
    print(f"  Variables: 10m_u_component_of_wind, 10m_v_component_of_wind")
    print(f"  Area: North 24°, West 68°, South 6°, East 89° (Indian Ocean)")
    print(f"  Target File: {target_nc}")
    print(f"========================================================\n")
    print("[*] Submitting request to Copernicus Climate Data Store...")

    try:
        client.retrieve(
            'reanalysis-era5-single-levels',
            {
                'product_type': ['reanalysis'],
                'variable': [
                    '10m_u_component_of_wind',
                    '10m_v_component_of_wind',
                ],
                'year': [year],
                'month': [month],
                'day': days,
                'time': [
                    '00:00', '06:00', '12:00', '18:00'
                ],
                'data_format': 'netcdf',
                'download_format': 'unarchived',
                'area': [24, 68, 6, 89],  # North, West, South, East
            },
            str(target_nc)
        )
        print(f"\n[SUCCESS] Successfully downloaded ERA5 wind data -> {target_nc}\n")
    except Exception as e:
        err_msg = str(e)
        print(f"\n[ERROR] CDS download failed: {err_msg}")
        if "terms" in err_msg.lower() or "licence" in err_msg.lower() or "required" in err_msg.lower():
            print("\n[!] ACTION REQUIRED: You must accept the dataset terms once on the website:")
            print("    1. Visit: https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=download")
            print("    2. Scroll to the bottom and click 'Accept Terms'.")
            print("    3. Then rerun this script.\n")


def main():
    parser = argparse.ArgumentParser(description="Download ERA5 wind data for Indian Ocean")
    parser.add_argument("--key", type=str, help="Copernicus CDS Personal Access Token")
    parser.add_argument("--year", type=str, default="2024", help="Year (default: 2024)")
    parser.add_argument("--month", type=str, default="01", help="Month (default: 01)")

    args = parser.parse_args()
    download_era5(api_key=args.key, year=args.year, month=args.month)


if __name__ == "__main__":
    main()
