"""
Spill service — geometric characterization and business logic.
Wraps OpenCV contour analysis and U-Net inference.
"""
import numpy as np
import cv2
from datetime import datetime, timezone
from shapely.geometry import Polygon, MultiPolygon


def characterize_mask(mask_array, pixel_size_m=10.0):
    """
    Compute geometric characterization from a segmentation mask.
    
    Args:
        mask_array: numpy array where 0=Oil, 1=Look-alike, 2=Sea
        pixel_size_m: Ground sample distance in meters
    
    Returns:
        dict with area_sq_km, perimeter_km, elongation_ratio, fragmentation_index, age_estimate
    """
    # Extract oil class pixels
    oil_mask = (mask_array == 0).astype(np.uint8) * 255
    
    # Find contours
    contours, _ = cv2.findContours(oil_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return {
            "area_sq_km": 0.0,
            "perimeter_km": 0.0,
            "elongation_ratio": 0.0,
            "fragmentation_index": 0.0,
            "age_estimate": "unknown",
            "num_components": 0,
        }
    
    # Filter small contours (noise)
    min_area_pixels = 50
    significant_contours = [c for c in contours if cv2.contourArea(c) >= min_area_pixels]
    
    if not significant_contours:
        return {
            "area_sq_km": 0.0,
            "perimeter_km": 0.0,
            "elongation_ratio": 0.0,
            "fragmentation_index": 0.0,
            "age_estimate": "unknown",
            "num_components": 0,
        }
    
    # Total area & perimeter
    total_area_pixels = sum(cv2.contourArea(c) for c in significant_contours)
    total_perimeter_pixels = sum(cv2.arcLength(c, True) for c in significant_contours)
    
    area_sq_km = total_area_pixels * (pixel_size_m ** 2) / 1e6
    perimeter_km = total_perimeter_pixels * pixel_size_m / 1e3
    
    # Elongation ratio (from bounding rect of largest contour)
    largest = max(significant_contours, key=cv2.contourArea)
    rect = cv2.minAreaRect(largest)
    width, height = rect[1]
    if min(width, height) > 0:
        elongation_ratio = max(width, height) / min(width, height)
    else:
        elongation_ratio = 1.0
    
    # Fragmentation index
    num_components = len(significant_contours)
    fragmentation_index = num_components / max(area_sq_km, 0.001)
    
    # Age estimate
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
        "num_components": num_components,
    }


def determine_severity(area_sq_km, coast_proximity_km=None):
    """Assign severity tier based on spill size and coast proximity."""
    if area_sq_km > 50 or (coast_proximity_km is not None and coast_proximity_km < 5):
        return "critical"
    elif area_sq_km > 10 or (coast_proximity_km is not None and coast_proximity_km < 20):
        return "high"
    elif area_sq_km > 1:
        return "medium"
    else:
        return "low"


def compute_impact_priority(area_sq_km, overlaps_mpa, overlaps_coral, coast_proximity_km):
    """Compute response priority tier."""
    score = 0
    
    # Area scoring
    if area_sq_km > 50: score += 40
    elif area_sq_km > 10: score += 25
    elif area_sq_km > 1: score += 10
    
    # Ecological overlap
    if overlaps_mpa: score += 25
    if overlaps_coral: score += 20
    
    # Coast proximity
    if coast_proximity_km < 5: score += 30
    elif coast_proximity_km < 20: score += 15
    elif coast_proximity_km < 50: score += 5
    
    if score >= 60: return "critical"
    elif score >= 40: return "high"
    elif score >= 20: return "medium"
    else: return "low"
