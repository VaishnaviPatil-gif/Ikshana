"""
Generate a small, clearly-labelled SYNTHETIC surface-current field for demos.

Why this exists: real CMEMS data needs a Copernicus Marine login, so the repo can't ship it.
Rather than silently falling back to a constant 0.25 m/s arrow, the drift engine loads this
file (time- and space-varying) and LABELS every result "SYNTHETIC demo current field".
Replace it with a real export by running:  python -m scripts.download_cmems

Pattern: an idealised West India Coastal Current (poleward along the shelf during the
NE monsoon) with a rotating tidal/inertial component and a weak offshore eddy, on the same
0.25° grid and variable names (uo/vo, time/latitude/longitude) as the CMEMS product, so
the loader code path is identical for real and synthetic data.

Run: python -m scripts.generate_synthetic_currents [--start 2024-03-13 --days 5]
"""
import argparse
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

try:
    import xarray as xr
except ImportError as e:  # pragma: no cover
    raise SystemExit("xarray + netCDF4 are required: pip install xarray netCDF4") from e

OUT = Path(__file__).resolve().parent.parent / "data" / "cmems" / "currents_india_synthetic.nc"


def build(start: datetime, days: int, step_hours: int = 6) -> "xr.Dataset":
    lats = np.arange(6.0, 24.01, 0.25)
    lons = np.arange(68.0, 89.01, 0.25)
    n_t = int(days * 24 / step_hours) + 1
    times = np.array([start + timedelta(hours=step_hours * i) for i in range(n_t)], dtype="datetime64[ns]")

    LON, LAT = np.meshgrid(lons, lats)
    uo = np.zeros((n_t, len(lats), len(lons)), dtype=np.float32)
    vo = np.zeros_like(uo)

    # Distance from an idealised west-coast shelf line (lon ≈ 72.5 + 0.12*(lat-8))
    shelf_lon = 72.5 + 0.12 * (LAT - 8.0)
    off_shelf = LON - shelf_lon                    # positive = offshore (west is negative here)
    coastal = np.exp(-((off_shelf + 0.6) ** 2) / (2 * 0.9 ** 2))   # band hugging the coast

    for i in range(n_t):
        hrs = i * step_hours
        # Poleward WICC (~0.3 m/s) that strengthens/weakens over the run
        wicc = 0.30 * (1.0 + 0.25 * np.sin(2 * np.pi * hrs / (24 * 4)))
        # Rotating semi-diurnal component (12.42 h)
        phase = 2 * np.pi * hrs / 12.42
        tidal_u = 0.08 * np.cos(phase)
        tidal_v = 0.08 * np.sin(phase)
        # Weak anticyclonic eddy centred at 17.5N 69.5E, radius ~1.5°
        r = np.hypot(LON - 69.5, LAT - 17.5)
        eddy = 0.12 * np.exp(-(r ** 2) / (2 * 1.5 ** 2))
        eddy_u = eddy * (LAT - 17.5)
        eddy_v = -eddy * (LON - 69.5)
        # Background southwest-ward drift offshore
        bg_u, bg_v = -0.05, -0.04

        uo[i] = (coastal * (-0.05 * wicc) + tidal_u + eddy_u + bg_u).astype(np.float32)
        vo[i] = (coastal * wicc + tidal_v + eddy_v + bg_v).astype(np.float32)

    ds = xr.Dataset(
        {
            "uo": (("time", "latitude", "longitude"), uo, {"units": "m s-1", "long_name": "Eastward velocity (SYNTHETIC)"}),
            "vo": (("time", "latitude", "longitude"), vo, {"units": "m s-1", "long_name": "Northward velocity (SYNTHETIC)"}),
        },
        coords={"time": times, "latitude": lats.astype(np.float32), "longitude": lons.astype(np.float32)},
        attrs={
            "title": "SYNTHETIC surface current field for SARVAS demo",
            "source": "scripts/generate_synthetic_currents.py — idealised WICC + tide + eddy. NOT observational data.",
            "warning": "Synthetic. Replace with a CMEMS export (python -m scripts.download_cmems) for real analysis.",
            "grid": "0.25 deg, 6-hourly",
        },
    )
    return ds


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--start", default="2024-03-13")
    p.add_argument("--days", type=int, default=5)
    p.add_argument("--out", default=str(OUT))
    a = p.parse_args()
    ds = build(datetime.strptime(a.start, "%Y-%m-%d"), a.days)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    enc = {v: {"zlib": True, "complevel": 6} for v in ("uo", "vo")}
    ds.to_netcdf(a.out, encoding=enc)
    print(f"[OK] wrote {a.out} ({Path(a.out).stat().st_size/1024:.0f} KB) — SYNTHETIC, labelled in file attrs")


if __name__ == "__main__":
    main()
