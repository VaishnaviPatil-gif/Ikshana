"""
Anomaly detection module for AIS vessel behavior analysis.
Combines rule-based threshold flags with sklearn IsolationForest.

Rule-based anomalies:
    - Speed drop: SOG drops below threshold for sustained period
    - Course change: COG changes > threshold within time window
    - AIS gap: No AIS report for > threshold duration
    - Route deviation: Position deviates from expected route

IsolationForest:
    - Unsupervised outlier detection on vessel behavior features
    - Features: mean_speed, speed_variance, course_variance, gap_count, 
      gap_max_duration, track_sinuosity
"""
import numpy as np
import pandas as pd
from datetime import timedelta
from sklearn.ensemble import IsolationForest

from app.config import settings


def detect_speed_drops(track_df, threshold_knots=None, min_duration_minutes=None):
    """
    Detect periods where vessel speed drops below threshold.
    
    Args:
        track_df: DataFrame with columns [base_datetime, sog, lat, lon]
        threshold_knots: Speed threshold (default from settings)
        min_duration_minutes: Minimum sustained duration (default from settings)
    
    Returns:
        List of anomaly dicts {detected_at, value, threshold, description}
    """
    threshold = threshold_knots or settings.SPEED_DROP_THRESHOLD
    min_duration = min_duration_minutes or settings.SPEED_DROP_DURATION

    anomalies = []
    if track_df.empty or 'sog' not in track_df.columns:
        return anomalies

    slow_mask = track_df['sog'] < threshold
    slow_groups = []
    current_group = []

    for idx, row in track_df.iterrows():
        if row['sog'] < threshold:
            current_group.append(row)
        else:
            if current_group:
                slow_groups.append(current_group)
                current_group = []
    if current_group:
        slow_groups.append(current_group)

    for group in slow_groups:
        if len(group) < 2:
            continue
        start_time = group[0]['base_datetime']
        end_time = group[-1]['base_datetime']
        duration_min = (end_time - start_time).total_seconds() / 60

        if duration_min >= min_duration:
            avg_speed = np.mean([r['sog'] for r in group])
            anomalies.append({
                "anomaly_type": "speed_drop",
                "detected_at": start_time,
                "value": round(avg_speed, 2),
                "threshold": threshold,
                "description": (
                    f"Speed dropped to {avg_speed:.1f} knots (below {threshold} kn) "
                    f"for {duration_min:.0f} minutes"
                ),
            })

    return anomalies


def detect_course_changes(track_df, threshold_degrees=None):
    """Detect sudden course changes exceeding threshold."""
    threshold = threshold_degrees or settings.COURSE_CHANGE_THRESHOLD
    anomalies = []

    if track_df.empty or 'cog' not in track_df.columns or len(track_df) < 2:
        return anomalies

    cog_values = track_df['cog'].values
    times = track_df['base_datetime'].values

    for i in range(1, len(cog_values)):
        if np.isnan(cog_values[i]) or np.isnan(cog_values[i-1]):
            continue
        # Angular difference (handle 360° wrap)
        diff = abs(cog_values[i] - cog_values[i-1])
        if diff > 180:
            diff = 360 - diff

        if diff > threshold:
            anomalies.append({
                "anomaly_type": "course_change",
                "detected_at": pd.Timestamp(times[i]),
                "value": round(diff, 1),
                "threshold": threshold,
                "description": (
                    f"Course changed by {diff:.1f}° (threshold: {threshold}°) "
                    f"from {cog_values[i-1]:.0f}° to {cog_values[i]:.0f}°"
                ),
            })

    return anomalies


def detect_ais_gaps(track_df, threshold_minutes=None):
    """Detect gaps in AIS transmission exceeding threshold."""
    threshold = threshold_minutes or settings.AIS_GAP_THRESHOLD
    anomalies = []

    if track_df.empty or len(track_df) < 2:
        return anomalies

    times = sorted(track_df['base_datetime'].values)

    for i in range(1, len(times)):
        gap_min = (pd.Timestamp(times[i]) - pd.Timestamp(times[i-1])).total_seconds() / 60

        if gap_min > threshold:
            anomalies.append({
                "anomaly_type": "ais_gap",
                "detected_at": pd.Timestamp(times[i-1]),
                "value": round(gap_min, 1),
                "threshold": threshold,
                "description": (
                    f"AIS signal gap of {gap_min:.0f} minutes "
                    f"(threshold: {threshold} min) — possible transponder shutdown"
                ),
            })

    return anomalies


def detect_route_deviation(track_df, expected_route=None, threshold_nm=None):
    """
    Detect deviation from expected route.
    For demo: uses great-circle distance between consecutive points vs straight line.
    """
    threshold = threshold_nm or settings.ROUTE_DEVIATION_THRESHOLD
    anomalies = []

    if track_df.empty or len(track_df) < 3:
        return anomalies

    # Simple approach: check if vessel's track sinuosity exceeds threshold
    lats = track_df['lat'].values
    lons = track_df['lon'].values

    # Calculate direct distance (first to last point)
    from math import radians, sin, cos, sqrt, atan2
    def haversine_nm(lat1, lon1, lat2, lon2):
        R = 3440.065  # Earth radius in nautical miles
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
        return R * 2 * atan2(sqrt(a), sqrt(1-a))

    direct_dist = haversine_nm(lats[0], lons[0], lats[-1], lons[-1])

    # Calculate actual path distance
    actual_dist = sum(
        haversine_nm(lats[i], lons[i], lats[i+1], lons[i+1])
        for i in range(len(lats) - 1)
    )

    if direct_dist > 0:
        deviation_ratio = actual_dist / direct_dist
        if deviation_ratio > 1.5:  # Significant deviation from straight path
            deviation_nm = actual_dist - direct_dist
            anomalies.append({
                "anomaly_type": "route_deviation",
                "detected_at": pd.Timestamp(track_df['base_datetime'].values[len(track_df)//2]),
                "value": round(deviation_nm, 2),
                "threshold": threshold,
                "description": (
                    f"Route deviation: actual path {actual_dist:.1f} nm vs direct {direct_dist:.1f} nm "
                    f"(ratio: {deviation_ratio:.2f}x)"
                ),
            })

    return anomalies


def run_all_rule_based(track_df):
    """Run all rule-based anomaly detectors on a vessel's track data."""
    all_anomalies = []
    all_anomalies.extend(detect_speed_drops(track_df))
    all_anomalies.extend(detect_course_changes(track_df))
    all_anomalies.extend(detect_ais_gaps(track_df))
    all_anomalies.extend(detect_route_deviation(track_df))
    return all_anomalies


def compute_isolation_forest_score(vessels_features_df):
    """
    Run IsolationForest on vessel behavior features.
    
    Args:
        vessels_features_df: DataFrame with one row per vessel and columns:
            [vessel_id, mean_speed, speed_variance, course_variance, 
             gap_count, gap_max_duration, track_sinuosity]
    
    Returns:
        DataFrame with added 'if_anomaly_score' column (0-1, higher = more anomalous)
    """
    if vessels_features_df.empty or len(vessels_features_df) < 3:
        vessels_features_df['if_anomaly_score'] = 0.5
        return vessels_features_df

    feature_cols = [
        'mean_speed', 'speed_variance', 'course_variance',
        'gap_count', 'gap_max_duration', 'track_sinuosity'
    ]

    # Fill NaN
    features = vessels_features_df[feature_cols].fillna(0).values

    # Fit IsolationForest
    clf = IsolationForest(
        n_estimators=100,
        contamination=0.2,  # Expect ~20% anomalous (tuned for demo)
        random_state=42,
    )
    clf.fit(features)

    # Score: sklearn returns negative scores for anomalies, positive for normal
    # We invert and normalize to [0, 1] where 1 = most anomalous
    raw_scores = clf.decision_function(features)
    # Invert: more negative = more anomalous → higher score
    normalized = 1 - (raw_scores - raw_scores.min()) / (raw_scores.max() - raw_scores.min() + 1e-8)

    vessels_features_df = vessels_features_df.copy()
    vessels_features_df['if_anomaly_score'] = np.round(normalized, 4)

    return vessels_features_df


def extract_vessel_features(track_df):
    """
    Extract behavioral features from a single vessel's AIS track for IsolationForest.
    
    Returns:
        dict of feature values
    """
    if track_df.empty:
        return {
            'mean_speed': 0, 'speed_variance': 0, 'course_variance': 0,
            'gap_count': 0, 'gap_max_duration': 0, 'track_sinuosity': 1.0
        }

    speeds = track_df['sog'].dropna().values
    courses = track_df['cog'].dropna().values
    times = sorted(track_df['base_datetime'].values)

    # Speed features
    mean_speed = float(np.mean(speeds)) if len(speeds) > 0 else 0
    speed_variance = float(np.var(speeds)) if len(speeds) > 0 else 0

    # Course variance
    if len(courses) > 1:
        # Use circular variance
        cos_mean = np.mean(np.cos(np.radians(courses)))
        sin_mean = np.mean(np.sin(np.radians(courses)))
        course_variance = float(1 - np.sqrt(cos_mean**2 + sin_mean**2))
    else:
        course_variance = 0

    # Gap analysis
    gaps = []
    for i in range(1, len(times)):
        gap = (pd.Timestamp(times[i]) - pd.Timestamp(times[i-1])).total_seconds() / 60
        gaps.append(gap)

    gap_count = sum(1 for g in gaps if g > settings.AIS_GAP_THRESHOLD) if gaps else 0
    gap_max_duration = float(max(gaps)) if gaps else 0

    # Track sinuosity
    lats = track_df['lat'].values
    lons = track_df['lon'].values
    if len(lats) >= 2:
        from math import radians, sin, cos, sqrt, atan2
        def haversine(lat1, lon1, lat2, lon2):
            R = 3440.065
            dlat = radians(lat2 - lat1)
            dlon = radians(lon2 - lon1)
            a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
            return R * 2 * atan2(sqrt(a), sqrt(1-a))

        direct = haversine(lats[0], lons[0], lats[-1], lons[-1])
        actual = sum(haversine(lats[i], lons[i], lats[i+1], lons[i+1]) for i in range(len(lats)-1))
        sinuosity = actual / max(direct, 0.001)
    else:
        sinuosity = 1.0

    return {
        'mean_speed': round(mean_speed, 2),
        'speed_variance': round(speed_variance, 2),
        'course_variance': round(course_variance, 4),
        'gap_count': gap_count,
        'gap_max_duration': round(gap_max_duration, 1),
        'track_sinuosity': round(sinuosity, 3),
    }
