"""
Inference module for U-Net SAR oil spill segmentation.
Loads trained model, predicts mask, extracts polygons via OpenCV contours.
"""
import os
import numpy as np
import cv2
from shapely.geometry import Polygon, MultiPolygon

CLASS_NAMES = {0: "Oil", 1: "Look-alike", 2: "No oil"}


_CACHED_MODEL = None
_CACHED_IMG_SIZE = 512


def load_model(model_path, device=None):
    """Load trained U-Net model from checkpoint (cached singleton with minimal RAM footprint)."""
    global _CACHED_MODEL, _CACHED_IMG_SIZE
    if _CACHED_MODEL is not None:
        return _CACHED_MODEL, _CACHED_IMG_SIZE

    import gc
    import torch

    try:
        torch.set_num_threads(1)
    except Exception:
        pass

    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Priority 1: Check for traced TorchScript model (uses 0.38MB RAM instead of 198MB from SMP)
    traced_path = os.path.join(os.path.dirname(model_path), "unet_traced.pt")
    if os.path.exists(traced_path):
        try:
            model = torch.jit.load(traced_path, map_location=device)
            model.eval()
            _CACHED_MODEL = model
            _CACHED_IMG_SIZE = 256
            return _CACHED_MODEL, _CACHED_IMG_SIZE
        except Exception as e:
            print(f"[WARN] Failed to load traced model, falling back to checkpoint: {e}")

    # Priority 2: Standard SMP Unet from checkpoint
    import segmentation_models_pytorch as smp

    try:
        checkpoint = torch.load(model_path, map_location=device, mmap=True)
    except Exception:
        checkpoint = torch.load(model_path, map_location=device)

    model = smp.Unet(
        encoder_name=checkpoint.get("encoder", "resnet18"),
        encoder_weights=None,  # Don't download pretrained — we have our own weights
        in_channels=1,
        classes=checkpoint.get("classes", 3),
        activation=None,
    )
    try:
        model.load_state_dict(checkpoint["model_state_dict"], assign=True)
    except Exception:
        model.load_state_dict(checkpoint["model_state_dict"])

    model.to(device)
    model.eval()

    img_sz = checkpoint.get("image_size", 256)
    del checkpoint
    gc.collect()

    _CACHED_MODEL = model
    _CACHED_IMG_SIZE = img_sz
    return _CACHED_MODEL, _CACHED_IMG_SIZE


def predict_mask(model, image_input, image_size=512, device=None):
    """Run inference on a single SAR image (filepath or numpy array). Returns predicted class mask + probabilities."""
    import gc
    import torch
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Load image
    if isinstance(image_input, np.ndarray):
        image = image_input.copy()
    else:
        image = None
        try:
            import tifffile
            if str(image_input).lower().endswith(('.tif', '.tiff')):
                image = tifffile.imread(str(image_input))
        except Exception:
            pass
        if image is None:
            image = cv2.imread(str(image_input), cv2.IMREAD_UNCHANGED)
        if image is None:
            try:
                import rasterio
                with rasterio.open(str(image_input)) as src:
                    image = src.read(1)
            except Exception:
                raise ValueError(f"Could not read image: {image_input}")

    if image.ndim == 3:
        image = image[..., 0]

    original_h, original_w = image.shape[:2]

    # Resize and normalize
    resized = cv2.resize(image, (image_size, image_size), interpolation=cv2.INTER_LINEAR)
    resized = resized.astype(np.float32)
    img_min, img_max = resized.min(), resized.max()
    if img_max > img_min:
        resized = (resized - img_min) / (img_max - img_min)

    # To tensor [1, 1, H, W]
    tensor = torch.from_numpy(resized).unsqueeze(0).unsqueeze(0).to(device)

    with torch.inference_mode():
        output = model(tensor)  # [1, 3, H, W]
        probs = torch.softmax(output, dim=1)  # [1, 3, H, W]
        pred = output.argmax(dim=1).squeeze(0).cpu().numpy()  # [H, W]
        probs_np = probs.squeeze(0).cpu().numpy()  # [3, H, W]
        del tensor, output, probs
        gc.collect()

    # Resize back to original resolution
    pred_full = cv2.resize(pred.astype(np.uint8), (original_w, original_h), interpolation=cv2.INTER_NEAREST)

    return pred_full, probs_np


def extract_oil_polygons(mask, class_id=0, min_area_pixels=100):
    """Extract polygons from predicted mask for a given class using OpenCV contours."""
    binary = (mask == class_id).astype(np.uint8) * 255
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    polygons = []
    for contour in contours:
        if cv2.contourArea(contour) < min_area_pixels:
            continue
        # Simplify contour
        epsilon = 0.005 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        if len(approx) >= 3:
            coords = [(pt[0][0], pt[0][1]) for pt in approx]
            try:
                poly = Polygon(coords)
                if poly.is_valid and poly.area > 0:
                    polygons.append(poly)
            except Exception:
                continue

    if polygons:
        from shapely.ops import unary_union
        u = unary_union(polygons)
        if isinstance(u, Polygon):
            return MultiPolygon([u])
        elif isinstance(u, MultiPolygon):
            return u
        else:
            polys = [p for p in getattr(u, 'geoms', []) if isinstance(p, Polygon)]
            return MultiPolygon(polys) if polys else None
    return None


def characterize_geometry(polygons_multipolygon, pixel_size_m=10.0):
    """
    Compute geometric characterization of detected oil slick.
    
    Args:
        polygons_multipolygon: Shapely MultiPolygon of oil regions
        pixel_size_m: Ground sample distance in meters (approx for Sentinel-1)
    
    Returns:
        dict with area_sq_km, perimeter_km, elongation_ratio, fragmentation_index, age_estimate
    """
    if polygons_multipolygon is None or polygons_multipolygon.is_empty:
        return {
            "area_sq_km": 0.0,
            "perimeter_km": 0.0,
            "elongation_ratio": 0.0,
            "fragmentation_index": 0.0,
            "age_estimate": "unknown",
        }

    # Convert pixel measurements to real-world units
    area_m2 = polygons_multipolygon.area * (pixel_size_m ** 2)
    area_sq_km = area_m2 / 1e6

    perimeter_m = polygons_multipolygon.length * pixel_size_m
    perimeter_km = perimeter_m / 1e3

    # Elongation: ratio of bounding box dimensions
    minx, miny, maxx, maxy = polygons_multipolygon.bounds
    width = (maxx - minx) * pixel_size_m
    height = (maxy - miny) * pixel_size_m
    if min(width, height) > 0:
        elongation_ratio = max(width, height) / min(width, height)
    else:
        elongation_ratio = 1.0

    # Fragmentation index: number of separate polygons / total area
    # Higher = more fragmented = likely older spill
    num_components = len(list(polygons_multipolygon.geoms)) if hasattr(polygons_multipolygon, 'geoms') else 1
    fragmentation_index = num_components / max(area_sq_km, 0.001)

    # Age estimate heuristic
    if fragmentation_index < 1.0 and elongation_ratio < 3.0:
        age_estimate = "fresh"
    elif fragmentation_index < 5.0:
        age_estimate = "hours"
    elif fragmentation_index < 15.0:
        age_estimate = "day"
    else:
        age_estimate = "days"

    return {
        "area_sq_km": round(area_sq_km, 4),
        "perimeter_km": round(perimeter_km, 4),
        "elongation_ratio": round(elongation_ratio, 2),
        "fragmentation_index": round(fragmentation_index, 2),
        "age_estimate": age_estimate,
    }


def determine_severity(area_sq_km, coast_proximity_km=None):
    """Assign severity tier based on spill size and optional coast proximity."""
    if area_sq_km > 50 or (coast_proximity_km is not None and coast_proximity_km < 5):
        return "critical"
    elif area_sq_km > 10 or (coast_proximity_km is not None and coast_proximity_km < 20):
        return "high"
    elif area_sq_km > 1:
        return "medium"
    else:
        return "low"
