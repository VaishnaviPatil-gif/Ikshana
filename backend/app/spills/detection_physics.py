"""
Physics-informed SAR oil spill confidence and look-alike classification engine.
SIH26143 NTRO requirements:
  - Combine U-Net softmax class probabilities with SAR physical features and ERA5 wind.
  - Wind physics gate (<2.5 m/s calm-water look-alike risk, >10.0 m/s wind suppression).
  - SAR features: backscatter contrast (dB), edge sharpness, elongation, shape complexity, area, homogeneity.
  - Distinguish True Oil vs Look-alikes (low wind, biogenic film, rain cell, internal wave, ship wake, upwelling).
  - Return: class, confidence %, and top 3 contributing factors with numerical values.
"""
from __future__ import annotations
import math
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import cv2
from shapely.geometry import MultiPolygon, Polygon

# Centralized thresholds and weights
PHYSICS_CONFIG = {
    "wind_low_thresh_ms": 2.5,
    "wind_high_thresh_ms": 10.0,
    "min_contrast_db": 3.0,       # dB contrast expected for real oil
    "min_edge_sharpness": 15.0,    # Laplacian variance
    "min_elongation": 1.5,        # Slicks are usually elongated along wind/current
    "max_homogeneity_std": 25.0,   # Low interior variance inside slick
    "weights": {
        "unet_prob": 0.40,
        "wind_consistency": 0.20,
        "contrast": 0.15,
        "edge_sharpness": 0.10,
        "shape_complexity": 0.10,
        "interior_homogeneity": 0.05,
    }
}


def extract_sar_features(
    image: np.ndarray,
    mask: np.ndarray,
    pixel_size_m: float = 10.0
) -> Dict[str, float]:
    """
    Extract physical and morphometric SAR features from image and slick mask.
    image: 2D grayscale uint8 array [0, 255] or float
    mask: boolean 2D array (True for slick pixels)
    """
    if image.ndim == 3:
        image = image[..., 0]
    img = image.astype(np.float32)
    h, w = img.shape

    if mask is None or mask.sum() < 10:
        return {
            "contrast_db": 0.0,
            "edge_sharpness": 0.0,
            "elongation_ratio": 1.0,
            "shape_complexity": 1.0,
            "area_sq_km": 0.0,
            "interior_std": 0.0,
        }

    slick_pixels = img[mask]
    bg_mask = ~mask
    bg_pixels = img[bg_mask]

    # 1. Backscatter contrast in dB
    # Intensity I proportional to pixel^2 (power) or direct pixel values for linear SAR
    mean_slick = max(float(np.mean(slick_pixels)), 1.0)
    mean_bg = max(float(np.mean(bg_pixels)), 1.0)
    ratio = max(max(mean_bg, mean_slick) / max(min(mean_bg, mean_slick), 1.0), 1.001)
    contrast_db = round(float(10.0 * math.log10(ratio)), 2)

    # 2. Edge Sharpness via Laplacian gradient along mask boundary
    mask_u8 = mask.astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    boundary = cv2.morphologyEx(mask_u8, cv2.MORPH_GRADIENT, kernel) > 0
    if boundary.sum() > 5:
        lap = cv2.Laplacian(img, cv2.CV_32F)
        edge_sharpness = round(float(np.std(lap[boundary])), 2)
    else:
        edge_sharpness = 0.0

    # 3. Shape complexity (Isoperimetric Quotient: 4*pi*Area / P^2)
    contours, _ = cv2.findContours(mask_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    total_area_px = float(mask.sum())
    total_perimeter_px = sum(cv2.arcLength(c, True) for c in contours)
    if total_perimeter_px > 0:
        ipq = (4.0 * math.pi * total_area_px) / (total_perimeter_px ** 2)
        shape_complexity = round(float(1.0 - min(ipq, 1.0)), 3) # 0 = perfect circle, 1 = complex fractal
    else:
        shape_complexity = 0.5

    # 4. Elongation ratio
    if contours:
        largest_c = max(contours, key=cv2.contourArea)
        if len(largest_c) >= 5:
            (_, _), (MA, ma), _ = cv2.fitEllipse(largest_c)
            elongation = round(float(max(MA, ma) / max(min(MA, ma), 1.0)), 2)
        else:
            elongation = 1.5
    else:
        elongation = 1.0

    # 5. Interior homogeneity (standard deviation inside the slick)
    interior_std = round(float(np.std(slick_pixels)), 2)
    area_sq_km = round(float(total_area_px * (pixel_size_m ** 2) / 1e6), 4)

    # 6. Connected component analysis and scene coverage %
    total_scene_px = float(h * w)
    coverage_pct = round(float(total_area_px / total_scene_px * 100.0), 2)
    num_labels, labels_im, stats, _ = cv2.connectedComponentsWithStats(mask_u8)
    num_components = max(1, num_labels - 1)
    areas = stats[1:, cv2.CC_STAT_AREA] if num_labels > 1 else [0]
    max_component_px = max(areas) if len(areas) > 0 else 0
    largest_cc_pct = round(float(max_component_px / total_scene_px * 100.0), 2)

    return {
        "contrast_db": contrast_db,
        "edge_sharpness": edge_sharpness,
        "elongation_ratio": elongation,
        "shape_complexity": shape_complexity,
        "area_sq_km": area_sq_km,
        "interior_std": interior_std,
        "coverage_pct": coverage_pct,
        "num_components": num_components,
        "largest_cc_pct": largest_cc_pct,
    }


def compute_physics_confidence(
    unet_probs: Any,
    features: Dict[str, float],
    wind_speed_ms: Optional[float] = None
) -> Dict[str, Any]:
    """
    Combines U-Net prediction probabilities with physics rules to derive final classification,
    confidence %, and the top 3 contributing factors with their values.

    Canonical class ordering: 0=Oil, 1=Look-alike, 2=Sea (Clean Sea / No oil)

    Returns:
        {
            "final_class": "Oil" | "Look-alike" | "No oil",
            "final_confidence": float,  # == final_probabilities[final_class key]
            "raw_probabilities": {"oil": ..., "lookalike": ..., "sea": ...},
            "final_probabilities": {"oil": ..., "lookalike": ..., "sea": ...},  # sums to 1.0
            "top_contributing_factors": [...],
            "features": {...},
            "lookalike_cause": str | None,
            "wind_speed_ms": float | None,
        }

    Invariants enforced:
        1. final_class == argmax(final_probabilities)
        2. final_confidence == final_probabilities[class_key_for(final_class)]
        3. sum(final_probabilities.values()) == 1.0 (within floating point tolerance)
    """
    # --- Parse raw U-Net probabilities ---
    if isinstance(unet_probs, np.ndarray):
        if unet_probs.ndim >= 3:
            raw_oil_prob = float(unet_probs[0].mean())
            raw_lookalike_prob = float(unet_probs[1].mean())
            raw_sea_prob = float(unet_probs[2].mean())
        elif len(unet_probs) >= 3:
            raw_oil_prob = float(unet_probs[0])
            raw_lookalike_prob = float(unet_probs[1])
            raw_sea_prob = float(unet_probs[2])
        else:
            raw_oil_prob, raw_lookalike_prob, raw_sea_prob = 0.33, 0.33, 0.34
    elif isinstance(unet_probs, dict):
        raw_oil_prob = float(unet_probs.get("oil", 0.0))
        raw_lookalike_prob = float(unet_probs.get("lookalike", 0.0))
        raw_sea_prob = float(unet_probs.get("sea", unet_probs.get("no_oil", 0.0)))
    else:
        raw_oil_prob, raw_lookalike_prob, raw_sea_prob = 0.33, 0.33, 0.34

    # Normalize raw probabilities to sum to 1.0
    raw_total = raw_oil_prob + raw_lookalike_prob + raw_sea_prob
    if raw_total > 1e-6:
        raw_oil_prob /= raw_total
        raw_lookalike_prob /= raw_total
        raw_sea_prob /= raw_total

    raw_probabilities = {
        "oil": round(raw_oil_prob, 4),
        "lookalike": round(raw_lookalike_prob, 4),
        "sea": round(raw_sea_prob, 4),
    }

    cfg = PHYSICS_CONFIG
    factors = []

    # Factor 1: U-Net Model Confidence
    factors.append({
        "factor": "U-Net CNN Segmentation",
        "value": f"{raw_oil_prob * 100:.1f}% raw oil probability",
        "score": raw_oil_prob,
        "weight": cfg["weights"]["unet_prob"]
    })

    # Factor 2: Wind Speed Physics Gate
    wind_score = 0.85
    lookalike_cause = None
    if wind_speed_ms is None:
        factors.append({
            "factor": "ERA5 Wind Consistency",
            "value": "Unavailable (Neutral gate)",
            "score": 0.5,
            "weight": cfg["weights"]["wind_consistency"]
        })
    elif wind_speed_ms < cfg["wind_low_thresh_ms"]:
        wind_score = max(0.1, wind_speed_ms / cfg["wind_low_thresh_ms"] * 0.4)
        lookalike_cause = f"Low wind calm-water dampening ({wind_speed_ms:.1f} m/s < {cfg['wind_low_thresh_ms']} m/s)"
        factors.append({
            "factor": "ERA5 Wind Gate (Look-alike Risk)",
            "value": f"{wind_speed_ms:.1f} m/s (Low wind: dampens capillary waves)",
            "score": wind_score,
            "weight": cfg["weights"]["wind_consistency"]
        })
    elif wind_speed_ms > cfg["wind_high_thresh_ms"]:
        wind_score = max(0.2, 1.0 - (wind_speed_ms - cfg["wind_high_thresh_ms"]) * 0.1)
        factors.append({
            "factor": "ERA5 Wind Gate (Wave Suppression)",
            "value": f"{wind_speed_ms:.1f} m/s (High wind: roughens sea)",
            "score": wind_score,
            "weight": cfg["weights"]["wind_consistency"]
        })
    else:
        wind_score = 1.0
        factors.append({
            "factor": "ERA5 Wind Gate (Optimal)",
            "value": f"{wind_speed_ms:.1f} m/s (Within {cfg['wind_low_thresh_ms']}–{cfg['wind_high_thresh_ms']} m/s detection window)",
            "score": 1.0,
            "weight": cfg["weights"]["wind_consistency"]
        })

    # Factor 3: Backscatter Contrast (dB)
    c_db = features.get("contrast_db", 0.0)
    contrast_score = min(1.0, max(0.0, c_db / 6.0))
    factors.append({
        "factor": "SAR Backscatter Contrast",
        "value": f"{c_db:.1f} dB (vs surrounding sea)",
        "score": contrast_score,
        "weight": cfg["weights"]["contrast"]
    })

    # Factor 4: Edge Sharpness
    sharpness = features.get("edge_sharpness", 0.0)
    sharp_score = min(1.0, max(0.0, sharpness / 30.0))
    factors.append({
        "factor": "Slick Boundary Sharpness",
        "value": f"{sharpness:.1f} gradient variance",
        "score": sharp_score,
        "weight": cfg["weights"]["edge_sharpness"]
    })

    # Factor 5: Morphology / Aspect Ratio & Plume Cohesion
    elong = features.get("elongation_ratio", 1.0)
    num_comp = features.get("num_components", 1)
    cov_pct = features.get("coverage_pct", 0.0)

    # Cohesive linear plume (ship wake) gets high score; highly fragmented amorphous patch gets low score
    if elong >= 2.5 and num_comp <= 10:
        morphology_score = 1.0
        morphology_desc = f"{elong:.1f}:1 aspect ratio, {num_comp} plume component(s) (Linear moving vessel wake)"
    elif num_comp > 30 or elong < 1.4:
        morphology_score = max(0.05, 0.40 - min(0.35, (num_comp / 200.0) * 0.35))
        morphology_desc = f"{elong:.1f}:1 aspect ratio, {num_comp} fragments (Amorphous natural calm/film)"
    else:
        morphology_score = min(1.0, max(0.1, elong / 3.0))
        morphology_desc = f"{elong:.1f}:1 elongation ratio"

    factors.append({
        "factor": "Slick Morphology & Cohesion",
        "value": morphology_desc,
        "score": morphology_score,
        "weight": cfg["weights"]["shape_complexity"]
    })

    # Calculate weighted oil confidence score from physics factors
    total_score = sum(f["score"] * f["weight"] for f in factors)
    total_weights = sum(f["weight"] for f in factors)
    physics_oil_score = total_score / max(total_weights, 1e-6)

    # --- Determine final predicted class ---
    has_slick = (features.get("area_sq_km", 0.0) > 0.05) and (features.get("contrast_db", 0.0) > 1.0)

    # Step 4 Sanity Check: Implausibly large scene coverage or extreme fragmentation
    is_implausibly_large_calm = (
        cov_pct > 50.0 or 
        (cov_pct > 35.0 and num_comp > 30 and elong < 2.0)
    )

    if not has_slick:
        predicted_class = "No oil"
    elif is_implausibly_large_calm:
        predicted_class = "Look-alike"
        lookalike_cause = f"Amorphous wide calm water / natural film ({cov_pct:.1f}% scene coverage, {num_comp} fragments, {elong:.1f}:1 aspect ratio)"
        factors.append({
            "factor": "Scene Coverage & Cohesion Check",
            "value": f"{cov_pct:.1f}% coverage, {num_comp} fragments (Implausibly large for tanker discharge)",
            "score": 0.05,
            "weight": 0.20
        })
    elif wind_speed_ms is not None and wind_speed_ms < cfg["wind_low_thresh_ms"] and raw_oil_prob < 0.65:
        predicted_class = "Look-alike"
        if not lookalike_cause:
            lookalike_cause = f"Low wind ({wind_speed_ms:.1f} m/s) / biogenic film"
    elif raw_lookalike_prob > raw_oil_prob or physics_oil_score < 0.40 or (elong < 1.4 and features.get("contrast_db", 0.0) < 3.0):
        predicted_class = "Look-alike"
        if not lookalike_cause:
            lookalike_cause = "Morphological / low contrast signature"
    else:
        predicted_class = "Oil"

    # --- Build final probabilities from physics-fused scores ---
    # The dominant class gets the physics-weighted confidence; remaining classes
    # share the residual proportionally to their raw U-Net values.
    CLASS_KEY_MAP = {"Oil": "oil", "Look-alike": "lookalike", "No oil": "sea"}
    dominant_key = CLASS_KEY_MAP[predicted_class]

    if predicted_class == "Oil":
        dominant_score = physics_oil_score
    elif predicted_class == "Look-alike":
        # Lookalike confidence: complement of physics oil score, bounded
        dominant_score = max(0.55, min(0.98, 1.0 - physics_oil_score))
    else:  # No oil
        dominant_score = max(0.55, min(0.98, raw_sea_prob))

    dominant_score = round(min(0.98, max(0.50, dominant_score)), 4)

    # Distribute remainder to non-dominant classes proportionally to raw probs
    remainder = 1.0 - dominant_score
    non_dominant_keys = [k for k in ("oil", "lookalike", "sea") if k != dominant_key]
    raw_map = {"oil": raw_oil_prob, "lookalike": raw_lookalike_prob, "sea": raw_sea_prob}
    non_dom_total = sum(raw_map[k] for k in non_dominant_keys)

    final_probs = {}
    final_probs[dominant_key] = dominant_score
    if non_dom_total > 1e-6:
        for k in non_dominant_keys:
            final_probs[k] = round(max(0.01, remainder * raw_map[k] / non_dom_total), 4)
    else:
        for i, k in enumerate(non_dominant_keys):
            final_probs[k] = round(max(0.01, remainder * (0.6 if i == 0 else 0.4)), 4)

    # Normalize to exactly 1.0
    fp_total = sum(final_probs.values())
    for k in final_probs:
        final_probs[k] = round(final_probs[k] / fp_total, 4)
    # Fix rounding: assign residual to dominant
    rounding_err = 1.0 - sum(final_probs.values())
    final_probs[dominant_key] = round(final_probs[dominant_key] + rounding_err, 4)

    # --- Enforce invariant: final_class == argmax(final_probabilities) ---
    actual_argmax = max(final_probs, key=final_probs.get)
    if actual_argmax != dominant_key:
        # Physics override created a non-dominant class; swap to make it dominant
        old_dom = final_probs[dominant_key]
        old_max = final_probs[actual_argmax]
        final_probs[dominant_key] = old_max
        final_probs[actual_argmax] = old_dom

    final_confidence = round(final_probs[dominant_key], 4)
    confidence_pct = round(final_confidence * 100, 1)

    # Top 3 contributing factors sorted by absolute impact (score * weight)
    sorted_factors = sorted(factors, key=lambda x: x["score"] * x["weight"], reverse=True)[:3]
    top_3 = [{
        "factor": sf["factor"],
        "value": sf["value"],
        "contribution": round(sf["score"] * 100, 1)
    } for sf in sorted_factors]

    return {
        "final_class": predicted_class,
        "final_confidence": final_confidence,
        "confidence_pct": confidence_pct,
        "raw_probabilities": raw_probabilities,
        "final_probabilities": final_probs,
        # Legacy keys for backward compatibility
        "class": predicted_class,
        "probabilities": final_probs,
        "top_contributing_factors": top_3,
        "features": features,
        "lookalike_cause": lookalike_cause,
        "wind_speed_ms": wind_speed_ms,
    }

