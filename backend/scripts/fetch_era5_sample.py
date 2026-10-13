"""
ERA5 Data Download Helper

To download real ERA5 data, you need a Copernicus Climate Data Store (CDS) account
and API key. Set up your ~/.cdsapirc file with your URL and key.
See: https://cds.climate.copernicus.eu/api-how-to

If cdsapi is not installed or the API key is not configured, this script will generate
a synthetic but realistic NetCDF file for the Indian Ocean region.
"""

import os
import numpy as np
import xarray as xr
import pandas as pd

def fetch_real_era5(output_path):
    try:
        import cdsapi
        c = cdsapi.Client()
        print("Downloading real ERA5 data...")
        c.retrieve(
            'reanalysis-era5-single-levels',
            {
                'product_type': 'reanalysis',
                'format': 'netcdf',
                'variable': [
                    '10m_u_component_of_wind', '10m_v_component_of_wind',
                ],
                'year': '2023',
                'month': '01',
                'day': '01',
                'time': [
                    '00:00', '06:00', '12:00', '18:00',
                ],
                'area': [
                    30, 40, -30, 100, # N, W, S, E (Indian Ocean approx)
                ],
            },
            output_path)
        return True
    except Exception as e:
        print(f"Failed to download real ERA5 data: {e}")
        return False

def generate_synthetic_era5(output_path):
    print("Generating synthetic ERA5 data...")
    # Indian Ocean Region
    lats = np.arange(-30.0, 30.1, 0.25)
    lons = np.arange(40.0, 100.1, 0.25)
    times = pd.date_range("2023-01-01", periods=4, freq="6h")
    
    # Simulate trade winds (easterly/southeasterly in SH, variable in NH)
    # Using broadcasting to create fields
    u_wind = np.zeros((len(times), len(lats), len(lons)))
    v_wind = np.zeros((len(times), len(lats), len(lons)))
    
    for i, lat in enumerate(lats):
        if lat < 0:
            u_base = -5.0 + np.random.randn()  # Easterly
            v_base = 2.0 + np.random.randn()   # Southerly
        else:
            u_base = 2.0 + np.random.randn()   # Westerly
            v_base = -1.0 + np.random.randn()  # Northerly
            
        u_wind[:, i, :] = u_base
        v_wind[:, i, :] = v_base
        
    ds = xr.Dataset(
        {
            "u10": (["time", "latitude", "longitude"], u_wind),
            "v10": (["time", "latitude", "longitude"], v_wind),
        },
        coords={
            "time": times,
            "latitude": lats,
            "longitude": lons,
        }
    )
    
    ds.attrs["description"] = "Synthetic ERA5 wind data for Indian Ocean region"
    ds.to_netcdf(output_path)
    print(f"Saved synthetic dataset to {output_path}")

def main():
    out_dir = "data/forcing"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "era5_sample.nc")
    
    if not fetch_real_era5(out_path):
        generate_synthetic_era5(out_path)

if __name__ == "__main__":
    main()
