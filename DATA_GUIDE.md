# 📦 Data Architecture & Out-of-the-Box Assets Guide

This guide details how data is packaged, stored, and managed across the **AegisOcean** platform so teammates can clone and develop with **zero friction**.

---

## 🎯 Summary: Zero-Download Development

To make collaboration painless and keep the Git repository ultra-lightweight (~73 MB), **all necessary runtime data is already pre-packaged out-of-the-box**:

1. **Lightweight GIS Boundaries**: India EEZ, national coastline, and coral reef sensitive zones are pre-converted into high-efficiency GeoJSON layers.
2. **Atmospheric Wind Vectors**: Real ECMWF ERA5 10-meter surface wind fields (`era5_wind_india.nc`, 584 KB) are included for hydrodynamic drift modeling.
3. **Pre-Trained U-Net Vision Model**: Pretrained weights (`unet_best.pth`, 54.7 MB) are included so satellite segmentation works on day 1.
4. **Interactive Demo SAR Suite**: 6 real Sentinel-1 test scenes (major spill, moderate slick, calm water look-alikes, clean shipping corridor) with ground truth masks are provided for instant upload and verification.
5. **Database Seed Script**: Generates all accounts, spills, AIS tracks, and suspect scoring in under 2 seconds.

---

## 🗺️ 1. GIS & Ecological Boundary Data (`backend/data/gis/`)

| File Path | Format | Size | Purpose | Included Out-of-the-Box? |
| :--- | :--- | :--- | :--- | :--- |
| `data/gis/eez/india_eez.geojson` | GeoJSON | ~551 KB | Exclusive Economic Zone maritime boundaries for sovereign jurisdiction checks | **YES** |
| `data/gis/coastline/india_coastline.geojson` | GeoJSON | ~786 KB | High-resolution coastal vectors for distance-to-shore and landfall risk calculation | **YES** |
| `data/gis/corals/coral_reefs.geojson` | GeoJSON | ~12.3 MB | UNEP-WCMC spatial polygons for vulnerable marine coral reef systems | **YES** |

> **Note on Raw GIS Packages**: Heavy raw GIS archives (such as the 164 MB `eez_v12.gpkg` and 34 MB `reefextent.gpkg`) are intentionally excluded. If you ever need to re-extract or adjust the boundaries, you can run:
> ```bash
> python -m scripts.process_eez
> python -m scripts.process_corals
> ```

---

## 🌬️ 2. Oceanographic & Wind Forcing (`backend/data/era5/` & `cmems/`)

The platform's hydrodynamic drift engine (`app/drift/simulation.py`) computes 24-hour backward origin backtracking and 48-hour forward dispersion trajectories using surface wind and ocean current vectors.

- **ERA5 Wind Field (`data/era5/era5_wind_india.nc` - 584 KB)**:
  - **Included out-of-the-box.** Provides 10-meter u-wind and v-wind components across the Arabian Sea and Bay of Bengal.
- **CMEMS Ocean Currents (`data/cmems/`)**:
  - Raw Copernicus current grids (`currents_india.nc`) are ~153 MB, exceeding GitHub's 100 MB limit.
  - **Automatic Fallback**: If the NetCDF file is not present, `simulation.py` automatically falls back to empirical regional oceanographic baselines (`0.25 m/s current, 215° bearing`).
  - **Optional Refresh**: If you want to fetch fresh live currents from Copernicus Marine, add your credentials and run:
    ```bash
    python -m scripts.download_cmems
    ```

---

## 🛰️ 3. SAR Satellite Imagery & ML Weights (`backend/data/sar/` & `backend/ml/`)

### A. Pre-Trained Model
- Located at `backend/ml/models/unet_best.pth` (~54.7 MB).
- PyTorch U-Net architecture with a ResNet backbone trained for 3-class segmentation:
  - `Class 0`: Oil Slick (low radar backscatter)
  - `Class 1`: Look-alike (biogenic films, low-wind damping, algal blooms)
  - `Class 2`: Background Open Sea

### B. Out-of-the-Box Demo Test Suite (`backend/data/sar/demo_for_judges/`)
You can immediately test the segmentation and attribution pipeline using these pre-packaged real Sentinel-1 test scenes:

| Scene ID | Description | Expected Classification |
| :--- | :--- | :--- |
| `demo_oil_spill_large.png` | Major crude oil discharge off Mumbai High offshore basin | High-priority oil slick; triggers full AIS dark ship attribution |
| `demo_oil_spill_moderate.png` | Moderate slick trailing commercial tanker approach | Validated oil discharge; triggers 24h backtrack origin simulation |
| `demo_lookalike_low_wind.png` | Natural biogenic film / calm sea slick | Correctly flagged as look-alike; avoids false alarms |
| `demo_lookalike_calm_water.png` | Low radar backscatter region | Correctly classified as non-petroleum look-alike |
| `demo_clean_sea_shipping_corridor.png` | High-traffic maritime shipping lane | Clean ocean baseline |
| `demo_clean_sea_offshore.png` | Open offshore Arabian Sea | Clean ocean baseline |

*Ground truth binary masks (`*_ground_truth_mask.png`) and full coordinate metadata (`demo_manifest.json`) are also included.*

### C. Raw Training Data (`Images/` & `Mask/`)
The raw 16+ GB training imagery is excluded from the Git repository to keep development fast and lightweight. If you wish to retrain the U-Net model from scratch, place your tiles into `backend/data/sar/Images/` and run:
```bash
python -m ml.train_unet --epochs 25 --batch-size 8 --lr 1e-4
```

---

## 🚢 4. AIS Vessel Data & Telemetry (`backend/scripts/`)

The platform supports both synthetic vessel traffic and live global telemetry:

1. **Out-of-the-Box Demo Vessels**: Pre-seeded in the database with historical tracks, flagged speed drops, and intentional transponder shutoffs.
2. **Synthetic Vessel Generator**: Generate realistic commercial container ships, chemical tankers, and fishing vessels:
   ```bash
   python -m scripts.generate_synthetic_ais --count 50 --region west_coast
   ```
3. **Live AIS Streaming**: Stream real-time ship positions directly into your database from [aisstream.io](https://aisstream.io):
   ```bash
   # Add your free AISSTREAM_API_KEY in backend/.env, then run:
   python -m scripts.stream_ais --region west_coast
   ```