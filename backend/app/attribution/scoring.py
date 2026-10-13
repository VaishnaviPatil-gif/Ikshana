"""
Explainable weighted suspect scoring for vessel attribution.

Multi-factor scoring with transparent sub-factor decomposition:
- Proximity to origin cone
- Time overlap with origin window
- AIS gap scoring
- Speed anomaly scoring
- Course anomaly scoring
- Route deviation scoring

Each factor: 0-100 (normalized), then weighted sum → total_score (0-100)
Confidence: based on data quality and factor agreement

Output language: ALWAYS "candidate vessel" / "attribution likelihood" — 
NEVER "confirmed culprit"
"""
import numpy as np
from math import radians, sin, cos, sqrt, atan2


# Scoring weights — each factor's contribution to total score
WEIGHTS = {
    "proximity": 0.25,
    "time_overlap": 0.20,
    "ais_gap": 0.20,
    "speed_anomaly": 0.15,
    "course_anomaly": 0.10,
    "route_deviation": 0.10,
}


def haversine_nm(lat1, lon1, lat2, lon2):
    """Haversine distance in nautical miles."""
    R = 3440.065
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))


def score_proximity(vessel_lat, vessel_lon, origin_lat, origin_lon, max_distance_nm=50):
    """
    Score based on closest approach distance to origin cone centroid.
    Closer = higher score.
    
    Returns: 0-100 score and explanation text
    """
    dist = haversine_nm(vessel_lat, vessel_lon, origin_lat, origin_lon)
    
    if dist <= 1:
        score = 100
    elif dist >= max_distance_nm:
        score = 0
    else:
        score = max(0, 100 * (1 - dist / max_distance_nm))
    
    explanation = (
        f"Distance from origin cone: {dist:.1f} nm. "
        f"{'Very close — strong spatial correlation' if score > 70 else ''}"
        f"{'Moderate proximity' if 30 <= score <= 70 else ''}"
        f"{'Relatively far from probable origin' if score < 30 else ''}"
    )
    return round(score, 1), explanation


def score_time_overlap(vessel_time_in_area_hours, origin_window_hours=24):
    """
    Score based on how long the vessel was in the origin area during the origin time window.
    
    Returns: 0-100 score and explanation text
    """
    if origin_window_hours <= 0:
        return 0, "No origin time window available"
    
    overlap_fraction = min(vessel_time_in_area_hours / origin_window_hours, 1.0)
    score = overlap_fraction * 100
    
    explanation = (
        f"Vessel was in origin area for {vessel_time_in_area_hours:.1f}h out of "
        f"{origin_window_hours}h origin window ({overlap_fraction*100:.0f}% overlap)"
    )
    return round(score, 1), explanation


def score_ais_gap(gap_duration_minutes, gap_near_spill=True):
    """
    Score based on AIS signal gaps near the spill time/location.
    Longer gaps near spill = higher suspicion.
    
    Returns: 0-100 score and explanation text
    """
    if gap_duration_minutes <= 5:
        score = 0
        explanation = "No significant AIS gaps detected"
    elif not gap_near_spill:
        score = min(gap_duration_minutes / 5, 30)
        explanation = f"AIS gap of {gap_duration_minutes:.0f} min detected but not near spill location"
    else:
        # Near spill: significant
        score = min(gap_duration_minutes / 2, 100)
        explanation = (
            f"AIS gap of {gap_duration_minutes:.0f} minutes near spill location — "
            f"{'potential deliberate transponder shutdown' if gap_duration_minutes > 60 else 'notable signal loss'}"
        )
    
    return round(score, 1), explanation


def score_speed_anomaly(speed_drop_events, min_speed_observed):
    """
    Score based on abnormal speed patterns near spill.
    
    Returns: 0-100 score and explanation text
    """
    if speed_drop_events == 0:
        return 0, "No speed anomalies detected near spill"
    
    score = min(speed_drop_events * 30 + (5 - min_speed_observed) * 10, 100)
    score = max(0, score)
    
    explanation = (
        f"{speed_drop_events} speed drop event(s) detected. "
        f"Minimum speed: {min_speed_observed:.1f} knots — "
        f"{'consistent with stopping for discharge' if min_speed_observed < 2 else 'notable slowdown'}"
    )
    return round(score, 1), explanation


def score_course_anomaly(course_change_events, max_course_change_deg):
    """
    Score based on unusual course changes near spill.
    
    Returns: 0-100 score and explanation text
    """
    if course_change_events == 0:
        return 0, "No unusual course changes detected"
    
    score = min(course_change_events * 25 + max_course_change_deg / 3, 100)
    
    explanation = (
        f"{course_change_events} sudden course change(s). "
        f"Maximum change: {max_course_change_deg:.0f}° — "
        f"{'consistent with evasive maneuvering' if max_course_change_deg > 90 else 'notable navigation change'}"
    )
    return round(score, 1), explanation


def score_route_deviation(deviation_nm, sinuosity_ratio):
    """
    Score based on deviation from expected route.
    
    Returns: 0-100 score and explanation text
    """
    if deviation_nm < 1 and sinuosity_ratio < 1.2:
        return 0, "Vessel maintained expected route"
    
    score = min(deviation_nm * 5 + (sinuosity_ratio - 1) * 50, 100)
    score = max(0, score)
    
    explanation = (
        f"Route deviation: {deviation_nm:.1f} nm from direct path. "
        f"Track sinuosity: {sinuosity_ratio:.2f}x — "
        f"{'significant detour suggesting intentional deviation' if deviation_nm > 10 else 'moderate route variation'}"
    )
    return round(score, 1), explanation


def compute_suspect_score(
    proximity_data,
    time_overlap_data,
    ais_gap_data,
    speed_data,
    course_data,
    route_data,
    isolation_forest_score=None,
):
    """
    Compute the full explainable suspect score for a vessel.
    
    Args:
        *_data: dict with keys specific to each scoring function
        isolation_forest_score: Optional IF anomaly score (0-1)
    
    Returns:
        dict with total_score, individual scores, confidence, and explanation
    """
    # Score each factor
    prox_score, prox_explain = score_proximity(**proximity_data)
    time_score, time_explain = score_time_overlap(**time_overlap_data)
    gap_score, gap_explain = score_ais_gap(**ais_gap_data)
    speed_score, speed_explain = score_speed_anomaly(**speed_data)
    course_score, course_explain = score_course_anomaly(**course_data)
    route_score, route_explain = score_route_deviation(**route_data)

    # Weighted sum
    total = (
        prox_score * WEIGHTS["proximity"]
        + time_score * WEIGHTS["time_overlap"]
        + gap_score * WEIGHTS["ais_gap"]
        + speed_score * WEIGHTS["speed_anomaly"]
        + course_score * WEIGHTS["course_anomaly"]
        + route_score * WEIGHTS["route_deviation"]
    )

    # Confidence: based on factor agreement and data quality
    scores = [prox_score, time_score, gap_score, speed_score, course_score, route_score]
    non_zero = [s for s in scores if s > 0]
    
    if len(non_zero) >= 4:
        confidence = min(0.9, total / 100 + 0.1)
    elif len(non_zero) >= 2:
        confidence = min(0.7, total / 100)
    else:
        confidence = min(0.4, total / 100)

    explanation = {
        "proximity": {"score": prox_score, "weight": WEIGHTS["proximity"], "detail": prox_explain},
        "time_overlap": {"score": time_score, "weight": WEIGHTS["time_overlap"], "detail": time_explain},
        "ais_gap": {"score": gap_score, "weight": WEIGHTS["ais_gap"], "detail": gap_explain},
        "speed_anomaly": {"score": speed_score, "weight": WEIGHTS["speed_anomaly"], "detail": speed_explain},
        "course_anomaly": {"score": course_score, "weight": WEIGHTS["course_anomaly"], "detail": course_explain},
        "route_deviation": {"score": route_score, "weight": WEIGHTS["route_deviation"], "detail": route_explain},
        "isolation_forest": {"score": isolation_forest_score, "note": "Unsupervised anomaly score (0-1)"},
        "summary": (
            f"Attribution likelihood: {total:.0f}/100 (confidence: {confidence:.0%}). "
            f"This vessel is a CANDIDATE — this is not a confirmed attribution."
        ),
    }

    return {
        "total_score": round(total, 1),
        "proximity_score": prox_score,
        "time_overlap_score": time_score,
        "ais_gap_score": gap_score,
        "speed_anomaly_score": speed_score,
        "course_anomaly_score": course_score,
        "route_deviation_score": route_score,
        "isolation_forest_score": isolation_forest_score,
        "confidence": round(confidence, 3),
        "explanation": explanation,
    }
