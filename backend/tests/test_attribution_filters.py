"""Traffic-filter and dead-reckoning logic on hand-built tracks (no DB needed)."""
from datetime import datetime, timezone, timedelta

import pandas as pd
from shapely.geometry import Point

from app.attribution.service import analyse_track, dead_reckon_gaps, _circular_std_deg

T0 = datetime(2024, 3, 14, 20, 0, tzinfo=timezone.utc)
T1 = T0 + timedelta(hours=6)
CONE = Point(71.95, 18.95).buffer(4 / 60.0)  # ~4 nm disc


def _track(points):
    return pd.DataFrame([{"base_datetime": T0 + timedelta(minutes=m), "lat": la, "lon": lo, "sog": s, "cog": c}
                         for m, la, lo, s, c in points])


def test_vessel_inside_cone_counts_time():
    df = _track([(0, 18.95, 71.95, 5, 90), (30, 18.951, 71.96, 5, 90), (60, 18.952, 71.97, 5, 90)])
    a = analyse_track(df, CONE, T0, T1)
    assert a["points_in_cone_window"] == 3 and a["minutes_in_cone"] == 60


def test_vessel_outside_window_is_not_counted():
    df = _track([(-600, 18.95, 71.95, 5, 90), (-570, 18.951, 71.96, 5, 90)])
    a = analyse_track(df, CONE, T0, T1)
    assert a["points_in_cone_window"] == 0 and a["points_in_window"] == 0


def test_dead_reckoning_flags_gap_crossing_cone():
    # last fix 8 nm west of cone heading east at 8 kn, 2 h blackout, reappears 8 nm east
    df = _track([(0, 18.95, 71.95 - 8 / 60 / 0.946, 8, 90), (120, 18.95, 71.95 + 8 / 60 / 0.946, 8, 90)])
    gaps = dead_reckon_gaps(df, CONE, T0, T1, gap_threshold_min=30)
    assert len(gaps) == 1
    g = gaps[0]
    assert g["gap_minutes"] == 120 and g["reconstructed_path_crosses_cone"] and g["overlaps_origin_window"]
    assert g["evidence"].startswith("STRONG")


def test_dead_reckoning_gap_far_from_cone_is_weak():
    df = _track([(0, 18.30, 71.30, 8, 90), (120, 18.30, 71.60, 8, 90)])
    gaps = dead_reckon_gaps(df, CONE, T0, T1, gap_threshold_min=30)
    assert len(gaps) == 1 and not gaps[0]["reconstructed_path_crosses_cone"]


def test_circular_std_handles_wraparound():
    assert _circular_std_deg(__import__("numpy").array([358.0, 2.0, 359.0, 1.0])) < 5
