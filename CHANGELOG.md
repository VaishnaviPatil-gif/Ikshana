# Changelog — science-chain fixes (SIH26143 review, 15 Sep 2026)

## Critical
- **C1/C2 Real AIS attribution** — `backend/app/attribution/service.py`: traffic reconstruction from `ais_tracks` inside the drift cone + origin window → filter (transit / edge clip / never-in-cone, reasons recorded) → `anomaly.py` detectors + IsolationForest → `scoring.py`. New `AttributionRun` table and `GET /api/attribution/{id}/traffic`. Anomaly feed now populated by the detectors.
- **C3 Georeferencing** — `backend/app/spills/georef.py`: pixel contours → EPSG:4326 via GeoTIFF affine + CRS; PNG uploads labelled `approximate_center_scale`; pixel size read from the file.
- **C4 Origin time** — capture time from Sentinel-1 product name / tags / operator; age as a range; `origin_time_earliest/likely/latest` on spills; drift starts from capture time.
- **C5 Drift** — `backend/app/drift/simulation.py`: RK4, per-particle time/space interpolation of ERA5 wind + current field, origin heatmap, forcing timeline, provenance/clamping warnings. Labelled synthetic current NetCDF shipped (`scripts/generate_synthetic_currents.py`).
- **C6 Honesty** — `backend/tests/` (28 tests), README rewritten (real vs synthetic table, judge Q&A, known limitations), `GET /api/limitations`.

## Improvements / extras
- Wind physics gate (Improve 4), age range heuristic with wind + contrast (Improve 2), uncertainty heatmap (Improve 3), tiled inference (Improve 5), Dice+Focal / augmentation / P-R-FPR / early stopping in `ml/train_unet.py` (Improve 1 — checkpoint not retrained).
- Dead-reckoning across AIS gaps (Extra 1), what-if drift endpoint `POST /api/drift/{id}/whatif` (Extra 6), SHA-256 evidence hashes + limitations in the PDF dossier (Extra 4/10).
- Seed script runs the real engines (`--reset` flag); API auto-adds new columns to an existing DB at startup.
- Frontend: real cone/heatmap/forward path/slick outline and candidate AIS tracks on the map (fake triangle + fake vessels removed); release window, traffic audit and per-suspect evidence in the Coast Guard dashboard; pixel size / capture time on the upload form.

## Not done (needs your hardware / accounts)
- Retraining the U-Net (run `python -m ml.train_unet` on a GPU).
- Real CMEMS currents / ERA5 for the spill date (`scripts/download_cmems.py`, `scripts/download_era5.py`).
- Extras 2, 3, 5, 7, 8, 9.
