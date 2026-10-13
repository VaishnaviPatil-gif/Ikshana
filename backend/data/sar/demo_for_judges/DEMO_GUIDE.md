# Judge Demonstration Guide: Real SAR Imagery Testing

This directory contains **authentic Sentinel-1 Synthetic Aperture Radar (SAR)** test samples held out from model training. You can upload these directly to the platform via the **SAR Satellite Imagery Ingestion** tab in the UI to demonstrate the platform's AI segmentation and attribution to the judges.

---

## Available Test Cases

| Case | Category | Image File | Location | Lat / Lon | Region | Expected AI Output |
|---|---|---|---|---|---|---|
| **1** | **Oil Spill** | `demo_oil_spill_large.png` | Mumbai Offshore Basin | 18.8500°N, 71.9000°E | `west_coast` | Severe oil slick detected. Polygon overlay + Area/Perimeter + Drift + Anomaly backtrack. |
| **2** | **Oil Spill** | `demo_oil_spill_moderate.png` | Gulf of Kutch Approach | 22.3120°N, 69.2150°E | `west_coast` | Moderate slick trailing tanker channel. Triggers suspect tanker ranking. |
| **3** | **Lookalike** | `demo_lookalike_low_wind.png` | Coromandel Coast | 13.0827°N, 80.4500°E | `southeast_coast` | Look-alike classified. Prevents false positive emergency dispatch. |
| **4** | **Lookalike** | `demo_lookalike_calm_water.png` | Palk Strait Nearshore | 9.2876°N, 79.3129°E | `southeast_coast` | Wind-shadow lookalike suppressed. |
| **5** | **Clean Sea** | `demo_clean_sea_offshore.png` | Goa Offshore EEZ | 15.2993°N, 73.4500°E | `west_coast` | Sea surface confirmed clean. Zero oil polygons. |
| **6** | **Clean Sea** | `demo_clean_sea_shipping_corridor.png` | Andaman Transit Lane | 11.6234°N, 92.7265°E | `andaman` | Verified clear of hydrocarbons. |

---

## How to Present During the Demo:
1. Log in to the platform as **Coast Guard** (`cg@demo.com` / `demo123`) or **Regional Manager** (`rm@demo.com` / `demo123`).
2. Navigate to the **Operational Ingestion Hub** (`DataUploadSection` or `/spills` -> Ingestion).
3. Select **SAR Satellite Imagery**.
4. Drag & drop `demo_oil_spill_large.png` (or click Browse to select from `C:\Users\Temporary User\Desktop\oil spill\backend\data\sar\demo_for_judges`).
5. Enter the suggested Latitude and Longitude from the table above (e.g., Lat: `18.85`, Lon: `71.90`).
6. Click **Analyze SAR Imagery**.
7. Watch the platform:
   - Run the U-Net segmentation model.
   - Extract vector contours and overlay them on the interactive map.
   - Project real-time backward trajectory to find the polluting vessel and forward trajectory using real CMEMS currents and ERA5 wind fields!
