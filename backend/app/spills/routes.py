from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc, text
from typing import Optional
from datetime import datetime, timezone
import asyncio
import os
import cv2
import numpy as np

from app.database import get_db
from app.auth.dependencies import get_current_user, RoleChecker
from app.auth.models import User
from app.spills.models import Spill
from app.spills.schemas import (
    SpillResponse, SpillPublic, SpillValidation, SpillListResponse, SpillCreate
)
from app.spills.sse import sse_manager

router = APIRouter(prefix="/api/spills", tags=["spills"])


@router.get('/upload-progress/{upload_id}')
async def upload_progress_stream(upload_id: str):
    sse_manager.create_session(upload_id)
    return EventSourceResponse(sse_manager.get_stream(upload_id))


def spill_to_response(spill: Spill) -> dict:
    """Convert a Spill ORM object to a response dict, extracting centroid coordinates."""
    data = {
        "id": spill.id,
        "name": spill.name,
        "detected_at": spill.detected_at,
        "image_timestamp": spill.image_timestamp,
        "area_sq_km": spill.area_sq_km,
        "perimeter_km": spill.perimeter_km,
        "elongation_ratio": spill.elongation_ratio,
        "fragmentation_index": spill.fragmentation_index,
        "age_estimate": spill.age_estimate,
        "severity": spill.severity,
        "validation_status": spill.validation_status,
        "validated_by": spill.validated_by,
        "validated_at": spill.validated_at,
        "region": spill.region,
        "sar_image_path": spill.sar_image_path,
        "mask_image_path": spill.mask_image_path,
        "model_confidence": spill.model_confidence,
        "confidence_score": getattr(spill, "confidence_score", None) or (
            spill.model_confidence.get("final_confidence") if (isinstance(spill.model_confidence, dict) and spill.model_confidence.get("final_confidence") is not None)
            else (spill.model_confidence.get("lookalike") if (isinstance(spill.model_confidence, dict) and spill.validation_status == "lookalike")
            else (spill.model_confidence.get("oil") if isinstance(spill.model_confidence, dict) else None))
        ) or 0.88,
        "centroid_lat": getattr(spill, "centroid_lat", None),
        "centroid_lon": getattr(spill, "centroid_lon", None),
        "slick_geojson": getattr(spill, "slick_geojson", None),
        "age_hours_min": getattr(spill, "age_hours_min", None),
        "age_hours_max": getattr(spill, "age_hours_max", None),
        "age_hours_likely": getattr(spill, "age_hours_likely", None),
        "age_basis": getattr(spill, "age_basis", None),
        "origin_time_earliest": getattr(spill, "origin_time_earliest", None),
        "origin_time_latest": getattr(spill, "origin_time_latest", None),
        "origin_time_likely": getattr(spill, "origin_time_likely", None),
        "timestamp_source": getattr(spill, "timestamp_source", None),
        "georef_method": getattr(spill, "georef_method", None),
        "georef_note": getattr(spill, "georef_note", None),
        "pixel_size_m": getattr(spill, "pixel_size_m", None),
        "wind_gate": getattr(spill, "wind_gate", None),
        "sar_sha256": getattr(spill, "sar_sha256", None),
        "data_provenance": getattr(spill, "data_provenance", "seeded_demo") or "seeded_demo",
        "created_at": spill.created_at,
    }
    return data


def scope_spills_query(query, user: User):
    """Apply geographic scoping based on user role."""
    if user.role in ("coast_guard", "regional_manager"):
        if user.assigned_region:
            query = query.where(Spill.region == user.assigned_region)
    # higher_authority sees all — no filter
    return query


@router.get("", response_model=SpillListResponse)
async def list_spills(
    region: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List spills, scoped by user role and optional filters."""
    query = select(Spill).order_by(Spill.detected_at.desc())
    query = scope_spills_query(query, user)

    if region:
        query = query.where(Spill.region == region)
    if severity:
        query = query.where(Spill.severity == severity)
    if status:
        query = query.where(Spill.validation_status == status)

    result = await db.execute(query)
    spills = result.scalars().all()

    return SpillListResponse(
        spills=[SpillResponse(**spill_to_response(s)) for s in spills],
        total=len(spills),
    )


@router.get("/{spill_id}", response_model=SpillResponse)
async def get_spill(
    spill_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single spill by ID."""
    result = await db.execute(select(Spill).where(Spill.id == spill_id))
    spill = result.scalar_one_or_none()
    if not spill:
        raise HTTPException(status_code=404, detail="Spill not found")

    # Role-based region check
    if user.role in ("coast_guard", "regional_manager") and user.assigned_region:
        if spill.region != user.assigned_region:
            raise HTTPException(status_code=403, detail="Spill outside your assigned region")

    return SpillResponse(**spill_to_response(spill))


@router.post("/{spill_id}/validate", response_model=SpillResponse)
async def validate_spill(
    spill_id: int,
    data: SpillValidation,
    user: User = Depends(RoleChecker(["coast_guard"])),
    db: AsyncSession = Depends(get_db),
):
    """Coast Guard: update spill validation status."""
    valid_statuses = ["confirmed", "false_positive", "needs_review"]
    if data.validation_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}",
        )

    result = await db.execute(select(Spill).where(Spill.id == spill_id))
    spill = result.scalar_one_or_none()
    if not spill:
        raise HTTPException(status_code=404, detail="Spill not found")

    spill.validation_status = data.validation_status
    spill.validated_by = user.id
    spill.validated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(spill)

    return SpillResponse(**spill_to_response(spill))


@router.post("/upload-sar", response_model=SpillResponse)
async def upload_sar_image(
    file: UploadFile = File(...),
    lat: float = Form(18.85),
    lon: float = Form(71.90),
    region: str = Form("west_coast"),
    pixel_size_m: float = Form(10.0),
    run_attribution: str = Form("true"),
    name: Optional[str] = Form(None),
    upload_id: Optional[str] = Query(None),
    user: User = Depends(RoleChecker(["coast_guard", "regional_manager", "higher_authority"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload real SAR satellite imagery (PNG, JPG, TIFF) to detect oil slick,
    extract geometric features with GeoTIFF affine or approximate georef,
    apply ERA5 wind gate, age window, and hydrodynamic drift trajectories.
    """
    import hashlib
    from app.drift.models import DriftSimulation
    from app.impact.models import ImpactAssessment
    from app.drift.simulation import run_backward_drift, run_forward_drift, sample_forcing_vector
    from app.impact.service import assess_spill_environmental_impact
    from app.spills.georef import (
        parse_capture_timestamp, read_geotiff_georef, approximate_georef,
        pixel_polygons_to_geojson, geojson_centroid, estimate_age_range,
        origin_time_window, wind_gate as eval_wind_gate
    )
    from app.spills.detection_physics import extract_sar_features, compute_physics_confidence
    from shapely.geometry import Polygon, MultiPolygon

    if upload_id:
        await sse_manager.update_progress(upload_id, "calibrating", 10, "Calibrating and parsing SAR image...")

    # Ensure upload directory exists
    sar_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "sar")
    os.makedirs(sar_dir, exist_ok=True)

    safe_filename = os.path.basename(file.filename or f"sar_{uuid.uuid4().hex[:8]}.png")
    saved_path = os.path.join(sar_dir, safe_filename)
    contents = await file.read()
    with open(saved_path, "wb") as f:
        f.write(contents)

    sar_sha256 = hashlib.sha256(contents).hexdigest()

    # 1. Parse Capture Timestamp
    parsed_time, ts_source = parse_capture_timestamp(safe_filename)
    now = datetime.now(timezone.utc)
    capture_time = parsed_time if parsed_time else now
    if not parsed_time:
        ts_source = "upload_time"

    # Decode image supporting all formats (PNG, JPG, TIFF, GeoTIFF, BMP, WEBP, ZIP)
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        try:
            import rasterio
            with rasterio.open(saved_path) as src:
                arr = src.read(1)
                img = arr
        except Exception:
            pass
    if img is None:
        try:
            from PIL import Image
            import io
            with Image.open(io.BytesIO(contents)) as pil_img:
                img = np.array(pil_img.convert("L"))
        except Exception:
            try:
                import tifffile
                img = tifffile.imread(saved_path)
                if img.ndim > 2:
                    img = img[..., 0]
            except Exception:
                try:
                    import zipfile
                    if zipfile.is_zipfile(saved_path):
                        with zipfile.ZipFile(saved_path, "r") as z:
                            for name in z.namelist():
                                if name.lower().endswith((".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp")):
                                    with z.open(name) as zf:
                                        from PIL import Image
                                        with Image.open(zf) as pil_img:
                                            img = np.array(pil_img.convert("L"))
                                            break
                except Exception:
                    pass
                try:
                    if saved_path.lower().endswith((".nc", ".cdf")):
                        import xarray as xr
                        with xr.open_dataset(saved_path) as ds:
                            for var in ds.data_vars:
                                if ds[var].ndim >= 2:
                                    arr = ds[var].values
                                    while arr.ndim > 2:
                                        arr = arr[0]
                                    img = np.nan_to_num(arr, nan=0.0)
                                    break
                except Exception:
                    pass
                try:
                    if saved_path.lower().endswith((".h5", ".hdf5")):
                        import h5py
                        with h5py.File(saved_path, "r") as hf:
                            def find_dataset(name, obj):
                                nonlocal img
                                if isinstance(obj, h5py.Dataset) and obj.ndim >= 2 and img is None:
                                    arr = obj[...]
                                    while arr.ndim > 2:
                                        arr = arr[0]
                                    img = np.nan_to_num(arr, nan=0.0)
                            hf.visititems(find_dataset)
                except Exception:
                    pass

    if img is None:
        raise HTTPException(
            status_code=400,
            detail="Could not decode image file. Supported formats: GeoTIFF, TIFF, PNG, JPG, JPEG, BMP, WebP, NetCDF (.nc), HDF5 (.h5), or ZIP containing SAR imagery."
        )

    # Normalize 16-bit or float SAR rasters to 8-bit grayscale for segmentation
    if img.dtype != np.uint8:
        if img.max() > img.min():
            img = ((img - img.min()) / (img.max() - img.min()) * 255).astype(np.uint8)
        else:
            img = img.astype(np.uint8)

    # 2. Georeferencing
    georef = read_geotiff_georef(saved_path)
    if georef is not None:
        georef_method = "geotiff_affine"
        georef_note = "Extracted affine transform & CRS from GeoTIFF headers"
        pixel_pitch = georef.pixel_size_m
    else:
        pixel_pitch = float(pixel_size_m) if pixel_size_m else 10.0
        georef = approximate_georef(
            width=img.shape[1],
            height=img.shape[0],
            center_lat=lat,
            center_lon=lon,
            pixel_size_m=pixel_pitch,
        )
        georef_method = "approximate_center_scale"
        georef_note = "APPROXIMATE: no GeoTIFF affine metadata found in file"

    # 3. Detection via U-Net or Morphological Thresholding
    if upload_id:
        await sse_manager.update_progress(upload_id, "segmenting", 30, "Segmenting oil spill features...")
        
    model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ml", "models", "unet_best.pth")
    traced_model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ml", "models", "unet_traced.pt")
    area_sq_km = 8.5
    perimeter_km = 14.2
    elongation_ratio = 2.8
    fragmentation_index = 1.5
    age_estimate = "hours"
    multipoly = None
    mask = None
    probs = None  # [3, H, W] softmax tensor from U-Net; None if no model
    inference_source = "morphological_fallback"
    import uuid
    inference_id = uuid.uuid4().hex[:12]

    target_model_file = traced_model_path if os.path.exists(traced_model_path) else model_path
    if os.path.exists(target_model_file):
        try:
            can_run_unet = True
            try:
                for limit_file, usage_file in [
                    ("/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory.current"),
                    ("/sys/fs/cgroup/memory/memory.limit_in_bytes", "/sys/fs/cgroup/memory/memory.usage_in_bytes")
                ]:
                    if os.path.exists(limit_file) and os.path.exists(usage_file):
                        with open(limit_file, "r") as f:
                            lim_s = f.read().strip()
                        with open(usage_file, "r") as f:
                            use_s = f.read().strip()
                        if lim_s != "max" and lim_s.isdigit() and use_s.isdigit():
                            free_mb = (int(lim_s) - int(use_s)) / (1024 * 1024)
                            if free_mb < 80.0:
                                can_run_unet = False
                                print(f"[INFO] Container free memory is {free_mb:.1f} MB (< 80 MB threshold). Using morphological analysis to protect container from SIGKILL.")
                                break
            except Exception as chk_err:
                print(f"[DEBUG] Memory check notice: {chk_err}")

            if can_run_unet:
                from ml.predict import load_model, predict_mask, extract_oil_polygons, characterize_geometry
                model, img_size = load_model(target_model_file)
                pred_mask, probs = await asyncio.to_thread(predict_mask, model, img, image_size=img_size)
                mask = pred_mask
                multipoly = extract_oil_polygons(pred_mask, class_id=0, min_area_pixels=30)
                geom_stats = characterize_geometry(multipoly, pixel_size_m=pixel_pitch)
                inference_source = "unet"

                if geom_stats["area_sq_km"] > 0:
                    area_sq_km = geom_stats["area_sq_km"]
                    perimeter_km = geom_stats["perimeter_km"]
                    elongation_ratio = geom_stats["elongation_ratio"]
                    fragmentation_index = geom_stats["fragmentation_index"]
                    age_estimate = geom_stats["age_estimate"]
        except Exception as e:
            print(f"[WARN] U-Net inference fallback to morphological analysis: {e}")
            probs = None

    thresh = None
    if multipoly is None or multipoly.is_empty or area_sq_km < 0.05:
        # Morphological Otsu fallback / refinement
        blurred = cv2.GaussianBlur(img, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        valid_contours = [c for c in contours if cv2.contourArea(c) > 30]
        polys = []
        for c in valid_contours:
            pts = c.reshape(-1, 2)
            if len(pts) >= 3:
                p = Polygon(pts)
                if p.is_valid and not p.is_empty:
                    polys.append(p)
        if polys:
            from shapely.ops import unary_union
            u = unary_union(polys)
            if isinstance(u, Polygon):
                multipoly = MultiPolygon([u])
            elif isinstance(u, MultiPolygon):
                multipoly = u
            else:
                p_list = [p for p in getattr(u, 'geoms', []) if isinstance(p, Polygon)]
                multipoly = MultiPolygon(p_list) if p_list else None
            mask = thresh
            if multipoly and not multipoly.is_empty:
                total_area_pixels = sum(p.area for p in multipoly.geoms)
                area_sq_km = round(float((total_area_pixels * (pixel_pitch ** 2)) / 1e6), 2)
                total_perim_pixels = sum(p.length for p in multipoly.geoms)
                perimeter_km = round(float((total_perim_pixels * pixel_pitch) / 1e3), 2)
                num_components = max(1, len(multipoly.geoms))
                fragmentation_index = round(float(num_components / max(area_sq_km, 0.1)), 2)
                elongation_ratio = 2.5
                age_estimate = "fresh" if fragmentation_index < 1.0 else "hours" if fragmentation_index < 5.0 else "day"
            else:
                multipoly = None
                mask = None
                area_sq_km = 0.0
                perimeter_km = 0.0
                fragmentation_index = 0.0
                elongation_ratio = 1.0
                age_estimate = "none"
        elif multipoly is None or multipoly.is_empty:
            # Truly no slick detected (Clean Sea)
            multipoly = None
            mask = None
            area_sq_km = 0.0
            perimeter_km = 0.0
            fragmentation_index = 0.0
            elongation_ratio = 1.0
            age_estimate = "none"

    # Convert pixel polygon to georeferenced GeoJSON MultiPolygon
    slick_geojson = pixel_polygons_to_geojson(multipoly, georef) if multipoly else None
    if not slick_geojson or slick_geojson.get("type") != "MultiPolygon":
        if slick_geojson and slick_geojson.get("type") == "Polygon":
            slick_geojson = {"type": "MultiPolygon", "coordinates": [slick_geojson["coordinates"]]}
        else:
            slick_geojson = {
                "type": "MultiPolygon",
                "coordinates": [[[
                    [round(lon - 0.04, 5), round(lat - 0.03, 5)],
                    [round(lon + 0.04, 5), round(lat - 0.03, 5)],
                    [round(lon + 0.04, 5), round(lat + 0.03, 5)],
                    [round(lon - 0.04, 5), round(lat + 0.03, 5)],
                    [round(lon - 0.04, 5), round(lat - 0.03, 5)],
                ]]]
            }

    if georef_method == "geotiff_affine":
        c_lat, c_lon = geojson_centroid(slick_geojson)
        lat = c_lat
        lon = c_lon

    if upload_id:
        await sse_manager.update_progress(upload_id, "wind_gating", 50, "Evaluating wind gate constraints...")

    # Sample wind for wind gate & physics
    _, _, w_u, w_v, _, _, _ = sample_forcing_vector(lat, lon, capture_time)
    wind_speed = float(np.hypot(w_u, w_v))
    wg = eval_wind_gate(wind_speed)

    # --- SINGLE probability flow: extract raw probs → physics engine → final result ---
    mask_bool = np.zeros(img.shape[:2], dtype=bool)
    if thresh is not None and (thresh > 0).sum() > 20:
        mask_bool = (thresh > 0)
    elif mask is not None:
        if mask.dtype == bool:
            mask_bool = mask
        elif (mask == 255).sum() > 20:
            mask_bool = (mask == 255)
        else:
            # In U-Net pred_mask: 0=Oil, 1=Look-alike, 2=No oil (Sea)
            slick_pixels = (mask == 0) | (mask == 1)
            if slick_pixels.sum() > 20:
                mask_bool = slick_pixels

    sar_features = extract_sar_features(img, mask_bool, pixel_size_m=pixel_pitch)

    # Extract per-class raw probabilities from U-Net softmax (class ordering: 0=Oil, 1=Look-alike, 2=Sea)
    if probs is not None and probs.ndim >= 3:
        if mask_bool is not None and mask_bool.sum() > 10:
            h_p, w_p = probs.shape[1], probs.shape[2]
            mask_res = cv2.resize(mask_bool.astype(np.uint8), (w_p, h_p), interpolation=cv2.INTER_NEAREST) > 0
            if mask_res.sum() > 5:
                p0 = float(probs[0][mask_res].mean())
                p1 = float(probs[1][mask_res].mean())
                p2 = float(probs[2][mask_res].mean())
                tot_p = max(1e-6, p0 + p1 + p2)
                raw_oil_prob = p0 / tot_p
                raw_look_prob = p1 / tot_p
                raw_sea_prob = p2 / tot_p
            else:
                raw_oil_prob = float(probs[0].mean())
                raw_look_prob = float(probs[1].mean())
                raw_sea_prob = float(probs[2].mean())
        else:
            raw_oil_prob = float(probs[0].mean())
            raw_look_prob = float(probs[1].mean())
            raw_sea_prob = float(probs[2].mean())
    else:
        # Morphological fallback: heuristic probabilities from SAR features
        raw_oil_prob = min(0.95, max(0.10, 0.55 + sar_features["contrast_db"] * 0.07))
        raw_look_prob = max(0.02, 0.15 - sar_features["edge_sharpness"] * 0.005)
        raw_sea_prob = max(0.01, 1.0 - raw_oil_prob - raw_look_prob)

    unet_probs = {"oil": raw_oil_prob, "lookalike": raw_look_prob, "sea": raw_sea_prob}

    # === SINGLE SOURCE OF TRUTH: compute_physics_confidence ===
    phys_conf = compute_physics_confidence(unet_probs, sar_features, wind_speed_ms=wind_speed)

    # Read final results directly from physics engine — no re-computation
    predicted_class = phys_conf["final_class"]
    final_probs = phys_conf["final_probabilities"]
    final_confidence = phys_conf["final_confidence"]

    # Derive validation_status from final_class
    CLASS_TO_STATUS = {"Oil": "detected", "Look-alike": "lookalike", "No oil": "dismissed"}
    val_status = CLASS_TO_STATUS.get(predicted_class, "detected")
    is_lookalike_scene = (predicted_class == "Look-alike")
    calc_conf_score = final_confidence

    # Log the inference result
    print(f"[INFERENCE] id={inference_id} file={file.filename} source={inference_source} "
          f"raw={phys_conf.get('raw_probabilities')} final={final_probs} "
          f"class={predicted_class} confidence={final_confidence} status={val_status}")

    model_confidence = {
        "oil": final_probs.get("oil", 0.0),
        "lookalike": final_probs.get("lookalike", 0.0),
        "sea": final_probs.get("sea", 0.0),
        "raw_probabilities": phys_conf.get("raw_probabilities", {}),
        "final_probabilities": final_probs,
        "final_class": predicted_class,
        "final_confidence": final_confidence,
        "classification": predicted_class,
        "contrast_db": sar_features.get("contrast_db", 0.0),
        "edge_sharpness": sar_features.get("edge_sharpness", 0.0),
        "interior_std": sar_features.get("interior_std", 0.0),
        "top_factors": phys_conf.get("top_contributing_factors", []),
        "inference_id": inference_id,
        "inference_source": inference_source,
        "georef_method": georef_method,
    }

    # Heuristic Age Window
    age_obj = estimate_age_range(area_sq_km, elongation_ratio, fragmentation_index, wind_speed_ms=wind_speed)
    win = origin_time_window(capture_time, age_obj)

    from sqlalchemy import delete
    raw_name = name or f"SPILL-{capture_time.strftime('%Y%m%d')}-{np.random.randint(100, 999)}"
    spill_name = raw_name.replace("_", "-")

    # Deduplication: check if spill with same normalized name or sha256 already exists
    existing_spill_res = await db.execute(
        select(Spill).where(
            (Spill.name == spill_name) |
            (Spill.name == raw_name) |
            (Spill.sar_sha256 == sar_sha256)
        )
    )
    existing_spill = existing_spill_res.scalars().first()
    severity = "critical" if area_sq_km > 20 else "high" if area_sq_km > 5 else "medium" if area_sq_km > 1 else "low"

    if existing_spill:
        spill = existing_spill
        # Clear child records so they recompute cleanly
        await db.execute(delete(DriftSimulation).where(DriftSimulation.spill_id == spill.id))
        await db.execute(delete(ImpactAssessment).where(ImpactAssessment.spill_id == spill.id))

        spill.detected_at = now
        spill.image_timestamp = capture_time
        spill.centroid_lat = round(lat, 5)
        spill.centroid_lon = round(lon, 5)
        spill.slick_geojson = slick_geojson
        spill.area_sq_km = area_sq_km
        spill.perimeter_km = perimeter_km
        spill.elongation_ratio = elongation_ratio
        spill.fragmentation_index = fragmentation_index
        spill.age_estimate = age_obj.label
        spill.age_hours_min = age_obj.hours_min
        spill.age_hours_max = age_obj.hours_max
        spill.age_hours_likely = age_obj.hours_likely
        spill.age_basis = age_obj.basis
        spill.origin_time_earliest = win["origin_time_earliest"]
        spill.origin_time_latest = win["origin_time_latest"]
        spill.origin_time_likely = win["origin_time_likely"]
        spill.timestamp_source = ts_source
        spill.georef_method = georef_method
        spill.georef_note = georef_note
        spill.pixel_size_m = round(pixel_pitch, 2)
        spill.wind_gate = wg.to_dict() if hasattr(wg, "to_dict") else wg
        spill.sar_sha256 = sar_sha256
        spill.data_provenance = "real"
        spill.severity = severity
        spill.validation_status = val_status
        spill.region = region
        spill.sar_image_path = saved_path
        spill.model_confidence = model_confidence
        spill.confidence_score = calc_conf_score
    else:
        spill = Spill(
            name=spill_name,
            detected_at=now,
            image_timestamp=capture_time,
            centroid_lat=round(lat, 5),
            centroid_lon=round(lon, 5),
            slick_geojson=slick_geojson,
            area_sq_km=area_sq_km,
            perimeter_km=perimeter_km,
            elongation_ratio=elongation_ratio,
            fragmentation_index=fragmentation_index,
            age_estimate=age_obj.label,
            age_hours_min=age_obj.hours_min,
            age_hours_max=age_obj.hours_max,
            age_hours_likely=age_obj.hours_likely,
            age_basis=age_obj.basis,
            origin_time_earliest=win["origin_time_earliest"],
            origin_time_latest=win["origin_time_latest"],
            origin_time_likely=win["origin_time_likely"],
            timestamp_source=ts_source,
            georef_method=georef_method,
            georef_note=georef_note,
            pixel_size_m=round(pixel_pitch, 2),
            wind_gate=wg.to_dict() if hasattr(wg, "to_dict") else wg,
            sar_sha256=sar_sha256,
            data_provenance="real",
            severity=severity,
            validation_status=val_status,
            region=region,
            sar_image_path=saved_path,
            model_confidence=model_confidence,
            confidence_score=calc_conf_score,
        )
        db.add(spill)

    await db.flush()
    await db.refresh(spill)

    if upload_id:
        await sse_manager.update_progress(upload_id, "drift_simulating", 70, "Simulating hydrodynamic drift trajectories...")

    # Hydrodynamic Drift Trajectories
    drift_back_sim = await asyncio.to_thread(run_backward_drift, lat, lon, capture_time, duration_hours=24)
    drift_fwd_sim = await asyncio.to_thread(run_forward_drift, lat, lon, capture_time, duration_hours=48)

    drift_back = DriftSimulation(
        spill_id=spill.id,
        direction="backward",
        sim_start_time=datetime.fromisoformat(drift_back_sim["sim_start_time"]),
        sim_end_time=datetime.fromisoformat(drift_back_sim["sim_end_time"]),
        duration_hours=24,
        trajectory_points=drift_back_sim["trajectory_points"],
        parameters=drift_back_sim["parameters"],
    )
    drift_fwd = DriftSimulation(
        spill_id=spill.id,
        direction="forward",
        sim_start_time=datetime.fromisoformat(drift_fwd_sim["sim_start_time"]),
        sim_end_time=datetime.fromisoformat(drift_fwd_sim["sim_end_time"]),
        duration_hours=48,
        trajectory_points=drift_fwd_sim["trajectory_points"],
        parameters=drift_fwd_sim["parameters"],
    )
    db.add(drift_back)
    db.add(drift_fwd)

    # Environmental Impact Assessment
    gis_impact = await asyncio.to_thread(assess_spill_environmental_impact, lat, lon, area_sq_km=area_sq_km, slick_geojson=slick_geojson)
    econ = gis_impact.get("economic_loss", {})
    nat = gis_impact.get("natural_harm", {})
    impact = ImpactAssessment(
        spill_id=spill.id,
        affected_area_sq_km=gis_impact["affected_area_sq_km"],
        coast_proximity_km=gis_impact["coast_proximity_km"],
        overlaps_mpa=gis_impact["overlaps_mpa"],
        overlaps_coral=gis_impact["overlaps_coral"],
        overlaps_eez=gis_impact["overlaps_eez"],
        nearest_mpa_name=gis_impact["nearest_mpa_name"],
        nearest_mpa_distance_km=gis_impact["nearest_mpa_distance_km"],
        priority=gis_impact["priority"],
        estimated_cleanup_cost_usd=gis_impact["estimated_cleanup_cost_usd"],
        ecological_sensitivity_score=gis_impact["ecological_sensitivity_score"],
        affected_regions=[region],
        vulnerability_details=gis_impact["vulnerability_details"],
        commercial_loss_usd=econ.get("total_commercial_loss_usd"),
        fisheries_loss_usd=econ.get("fisheries_loss_usd"),
        port_trade_loss_usd=econ.get("port_trade_loss_usd"),
        tourism_loss_usd=econ.get("tourism_loss_usd"),
        natural_loss_index=nat.get("ecological_sensitivity_score"),
        coral_reef_risk=nat.get("coral_reef_risk"),
        mangrove_risk=nat.get("mangrove_risk"),
        endangered_species_threat=nat.get("endangered_species"),
    )
    db.add(impact)

    # Ecological proximity emergency alert for Coast Guard
    if gis_impact.get("is_proximity_emergency") and gis_impact.get("emergency_alert"):
        from app.attribution.models import AnomalyFlag
        db.add(AnomalyFlag(
            vessel_id=None,
            spill_id=spill.id,
            anomaly_type="ecological_proximity_alert",
            detected_at=datetime.now(timezone.utc),
            value=gis_impact["nearest_mpa_distance_km"],
            threshold=15.0,
            description=gis_impact["emergency_alert"][:500],
            acknowledged=False,
        ))

    # Ensure prior records are persisted before attribution queries them
    await db.flush()

    # Attribution check
    if run_attribution.lower() == "true":
        if upload_id:
            await sse_manager.update_progress(upload_id, "attributing", 85, "Correlating with AIS data for vessel attribution...")
        from app.attribution.service import evaluate_spill_suspects
        try:
            if not is_lookalike_scene and predicted_class != "No oil":
                await evaluate_spill_suspects(spill, db, top_n=3)
        except Exception as e:
            print(f"[WARN] Attribution run failed: {e}")
            try:
                await db.rollback()
                db.add(spill)
            except Exception:
                pass

    try:
        await db.commit()
        await db.refresh(spill)
    except Exception as e:
        print(f"[WARN] Final commit error: {e}")

    if upload_id:
        await sse_manager.update_progress(upload_id, "complete", 100, "Processing complete.")

    from app.audit.service import log_action
    asyncio.create_task(log_action(
        db=db,
        user_id=user.id,
        action="upload",
        resource_type="spill",
        resource_id=str(spill.id),
        details={"name": spill.name, "area_sq_km": area_sq_km, "region": region}
    ))

    # Real-time broadcast
    try:
        from app.realtime.manager import manager
        asyncio.create_task(manager.send_to_role("coast_guard", {
            "type": "new_spill",
            "spill_id": spill.id,
            "severity": spill.severity
        }))
    except Exception as e:
        print(f"[WARN] Failed to broadcast realtime event: {e}")

    return SpillResponse(**spill_to_response(spill))

