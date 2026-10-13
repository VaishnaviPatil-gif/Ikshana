"""
Download ERA5 Wind and CMEMS Surface Currents for March 2024 (Spill Event Window).

Covers Spills:
  - SPILL-20240310-003 (2024-03-10)
  - SPILL-20240312-002 (2024-03-12)
  - SPILL-20240315-001 (2024-03-15)

Spatial Bounding Box:
  Latitude: 15°N to 23°N
  Longitude: 66°E to 75°E
Temporal Range:
  2024-03-10 to 2024-03-18
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

def download_march2024_era5(out_file: str = "data/era5/era5_wind_india_march2024.nc"):
    """Download ERA5 10m wind (u10, v10) for March 10-18, 2024."""
    try:
        import cdsapi
        client = cdsapi.Client()
        target = BACKEND_DIR / out_file
        target.parent.mkdir(parents=True, exist_ok=True)
        print(f"[*] Submitting ERA5 request for 2024-03-10 to 2024-03-18 (bbox: 23N, 66E, 15N, 75E)...")
        client.retrieve(
            'reanalysis-era5-single-levels',
            {
                'product_type': ['reanalysis'],
                'variable': ['10m_u_component_of_wind', '10m_v_component_of_wind'],
                'year': ['2024'],
                'month': ['03'],
                'day': [f"{d:02d}" for d in range(10, 19)],
                'time': ['00:00', '06:00', '12:00', '18:00'],
                'data_format': 'netcdf',
                'download_format': 'unarchived',
                'area': [23, 66, 15, 75],  # North, West, South, East
            },
            str(target)
        )
        print(f"[SUCCESS] Saved ERA5 wind to: {target}")
    except Exception as e:
        print(f"[ERROR] ERA5 download failed: {e}")
        print("Note: Ensure CDS_API_KEY is configured in backend/.env")

def download_march2024_cmems(out_file: str = "data/cmems/currents_india_march2024.nc"):
    """Download CMEMS surface currents (uo, vo) for March 10-18, 2024."""
    try:
        import copernicusmarine
        target = BACKEND_DIR / out_file
        target.parent.mkdir(parents=True, exist_ok=True)
        print(f"[*] Submitting CMEMS request for 2024-03-10 to 2024-03-18...")
        copernicusmarine.subset(
            dataset_id="cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
            variables=["uo", "vo"],
            minimum_longitude=66.0,
            maximum_longitude=75.0,
            minimum_latitude=15.0,
            maximum_latitude=23.0,
            start_datetime="2024-03-10",
            end_datetime="2024-03-18",
            output_directory=target.parent,
            output_filename=target.name,
            overwrite=True
        )
        print(f"[SUCCESS] Saved CMEMS currents to: {target}")
    except Exception as e:
        print(f"[ERROR] CMEMS download failed: {e}")
        print("Note: Run `python -m scripts.download_cmems --login` first.")

if __name__ == "__main__":
    print("=== SARVAS Forcing Data Downloader: March 2024 ===")
    download_march2024_era5()
    download_march2024_cmems()
