"""
Georeferencing, capture-time and slick-age utilities for SAR detections.

Fixes for SIH26143 review:
  * Critical 3 — turn detected pixel contours into real lon/lat polygons using the
    GeoTIFF affine transform + CRS (rasterio). PNG/JPG uploads without geo-info get an
    *approximate* centre+scale transform and are clearly labelled as such.
  * Critical 4 — read the SAR acquisition timestamp from the Sentinel-1 product name /
    GeoTIFF tags, and turn the age estimate into an origin-time WINDOW.
  * Improve 2 — age estimate as an hours range (min/max/likely) instead of a single label.
  * Improve 4 — wind "physics gate": oil is only reliably visible on SAR inside a wind band.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, List

import numpy as np

# --------------------------------------------------------------------------- #
# Capture timestamp
# --------------------------------------------------------------------------- #

# Sentinel-1 product names look like:
#   S1A_IW_GRDH_1SDV_20240315T005512_20240315T005537_052950_066A2E_1234.tiff
_S1_RE = re.compile(r"S1[ABCD]_[A-Z0-9]{2}_[A-Z0-9]{4}_[A-Z0-9]{4}_(\d{8}T\d{6})_(\d{8}T\d{6})", re.I)
# Generic fallbacks: 20240315T005512 / 20240315_005512 / 2024-03-15T00:55:12
_GENERIC_RES = [
    re.compile(r"(\d{4})(\d{2})(\d{2})[T_](\d{2})(\d{2})(\d{2})"),
    re.compile(r"(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})"),
]


def parse_capture_timestamp(filename: str, tags: Optional[dict] = None) -> Tuple[Optional[datetime], str]:
    """
    Try to recover the SAR acquisition (sensing start) time.

    Returns (timestamp | None, source) where source is one of
    'sentinel1_filename', 'filename_pattern', 'geotiff_tag', 'none'.
    """
    if filename:
        m = _S1_RE.search(filename)
        if m:
            return datetime.strptime(m.group(1), "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc), "sentinel1_filename"
        for rx in _GENERIC_RES:
            m = rx.search(filename)
            if m:
                y, mo, d, hh, mm, ss = (int(x) for x in m.groups())
                try:
                    return datetime(y, mo, d, hh, mm, ss, tzinfo=timezone.utc), "filename_pattern"
                except ValueError:
                    pass

    if tags:
        for key in ("ACQUISITION_START_TIME", "PRODUCT_START_TIME", "SENSING_START", "TIFFTAG_DATETIME", "DATETIME"):
            val = tags.get(key)
            if not val:
                continue
            for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y:%m:%d %H:%M:%S"):
                try:
                    return datetime.strptime(str(val), fmt).replace(tzinfo=timezone.utc), "geotiff_tag"
                except ValueError:
                    continue
    return None, "none"


# --------------------------------------------------------------------------- #
# Georeferencing
# --------------------------------------------------------------------------- #

@dataclass
class GeoRef:
    """Everything needed to map pixel (col,row) -> (lon,lat)."""
    method: str                      # geotiff_affine | approximate_center_scale
    pixel_size_m: float
    width: int
    height: int
    crs: str = "EPSG:4326"
    transform: Optional[tuple] = None   # rasterio Affine as 6-tuple (a,b,c,d,e,f) in source CRS
    center_lat: Optional[float] = None
    center_lon: Optional[float] = None
    tags: dict = field(default_factory=dict)
    note: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("tags", None)
        return d


def read_geotiff_georef(path: str) -> Optional[GeoRef]:
    """
    Read affine transform + CRS from a GeoTIFF. Returns None if the file is not a
    georeferenced raster (plain PNG/JPG, or TIFF with identity transform).
    """
    try:
        import rasterio
        from rasterio.warp import transform_bounds
    except Exception:
        return None
    try:
        with rasterio.open(path) as src:
            if src.crs is None or src.transform is None or src.transform.is_identity:
                return None
            t = src.transform
            crs_str = src.crs.to_string()
            # Pixel size in metres: if projected CRS the units are already metres;
            # for geographic CRS convert degrees -> metres at scene centre latitude.
            if src.crs.is_projected:
                pixel_size_m = float((abs(t.a) + abs(t.e)) / 2.0)
                w, s, e, n = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
            else:
                w, s, e, n = src.bounds
                mid_lat = (s + n) / 2.0
                px_m_x = abs(t.a) * 111_320.0 * math.cos(math.radians(mid_lat))
                px_m_y = abs(t.e) * 111_320.0
                pixel_size_m = float((px_m_x + px_m_y) / 2.0)
            return GeoRef(
                method="geotiff_affine",
                pixel_size_m=round(pixel_size_m, 3),
                width=src.width,
                height=src.height,
                crs=crs_str,
                transform=(t.a, t.b, t.c, t.d, t.e, t.f),
                center_lat=float((s + n) / 2.0),
                center_lon=float((w + e) / 2.0),
                tags=dict(src.tags()),
                note="Pixel coordinates mapped through the GeoTIFF affine transform and reprojected to EPSG:4326.",
            )
    except Exception:
        return None


def approximate_georef(width: int, height: int, center_lat: float, center_lon: float, pixel_size_m: float = 10.0) -> GeoRef:
    """
    Build an approximate north-up transform for images with no geo-information.
    The user supplies the scene centre and the ground sample distance.
    """
    deg_per_px_lat = pixel_size_m / 111_320.0
    deg_per_px_lon = pixel_size_m / (111_320.0 * max(1e-6, math.cos(math.radians(center_lat))))
    # Affine: x = c + a*col ; y = f + e*row   (e negative: rows go south)
    c = center_lon - deg_per_px_lon * width / 2.0
    f = center_lat + deg_per_px_lat * height / 2.0
    return GeoRef(
        method="approximate_center_scale",
        pixel_size_m=float(pixel_size_m),
        width=width,
        height=height,
        crs="EPSG:4326",
        transform=(deg_per_px_lon, 0.0, c, 0.0, -deg_per_px_lat, f),
        center_lat=center_lat,
        center_lon=center_lon,
        note=(
            "APPROXIMATE georeferencing: the uploaded image carries no geo-tags, so the operator-supplied "
            "scene centre and pixel size were used with a north-up assumption. Positions may be off by "
            "several kilometres. Upload the Sentinel-1 GeoTIFF for exact coordinates."
        ),
    )


def pixel_to_lonlat(cols: np.ndarray, rows: np.ndarray, georef: GeoRef) -> Tuple[np.ndarray, np.ndarray]:
    """Vectorised pixel -> (lon, lat) in EPSG:4326."""
    a, b, c, d, e, f = georef.transform
    cols = np.asarray(cols, dtype=float)
    rows = np.asarray(rows, dtype=float)
    x = c + a * cols + b * rows
    y = f + d * cols + e * rows
    if georef.crs.upper() not in ("EPSG:4326", "WGS84", "OGC:CRS84"):
        try:
            from pyproj import Transformer
            tr = Transformer.from_crs(georef.crs, "EPSG:4326", always_xy=True)
            x, y = tr.transform(x, y)
            x, y = np.asarray(x), np.asarray(y)
        except Exception:
            pass
    return x, y


def pixel_polygons_to_geojson(multipoly, georef: GeoRef) -> Optional[dict]:
    """
    Convert a shapely (Multi)Polygon in PIXEL coordinates (x=col, y=row) into an
    EPSG:4326 GeoJSON MultiPolygon.
    """
    if multipoly is None or multipoly.is_empty:
        return None
    from shapely.geometry import Polygon, MultiPolygon, mapping
    geoms = list(multipoly.geoms) if hasattr(multipoly, "geoms") else [multipoly]
    out = []
    for g in geoms:
        ext = np.array(g.exterior.coords)
        lon, lat = pixel_to_lonlat(ext[:, 0], ext[:, 1], georef)
        rings = [list(zip(lon.round(6).tolist(), lat.round(6).tolist()))]
        for interior in g.interiors:
            ic = np.array(interior.coords)
            ilon, ilat = pixel_to_lonlat(ic[:, 0], ic[:, 1], georef)
            rings.append(list(zip(ilon.round(6).tolist(), ilat.round(6).tolist())))
        try:
            poly = Polygon(rings[0], rings[1:])
            if not poly.is_valid:
                poly = poly.buffer(0)
            if not poly.is_empty:
                out.append(poly)
        except Exception:
            continue
    if not out:
        return None
    from shapely.ops import unary_union
    u = unary_union(out)
    if isinstance(u, Polygon):
        mp = MultiPolygon([u])
    elif isinstance(u, MultiPolygon):
        mp = u
    else:
        polys = [p for p in getattr(u, "geoms", []) if isinstance(p, Polygon)]
        mp = MultiPolygon(polys) if polys else None
    return mapping(mp) if mp is not None else None


def geojson_centroid(geojson: dict) -> Tuple[float, float]:
    from shapely.geometry import shape
    c = shape(geojson).centroid
    return float(c.y), float(c.x)


# --------------------------------------------------------------------------- #
# Age -> origin time window (Critical 4 / Improve 2)
# --------------------------------------------------------------------------- #

@dataclass
class AgeEstimate:
    label: str
    hours_min: float
    hours_max: float
    hours_likely: float
    basis: List[str]

    def to_dict(self):
        return asdict(self)


def estimate_age_range(
    area_sq_km: float,
    elongation_ratio: float,
    fragmentation_index: float,
    wind_speed_ms: Optional[float] = None,
    mean_backscatter_contrast: Optional[float] = None,
) -> AgeEstimate:
    """
    Heuristic slick-age estimator returning a RANGE in hours.

    Basis (all documented as heuristics, not a weathering model):
      * fragmentation  — oil breaks into patches as it weathers (main driver, kept from v1)
      * elongation     — long thin streaks form under sustained wind stress; very thin
                         streaks with high fragmentation are old, compact blobs are fresh
      * wind speed     — strong wind accelerates emulsification/dispersal → same shape is
                         reached sooner, so the window shifts younger
      * contrast       — (optional) weaker slick/sea backscatter contrast → older/thinner oil
    """
    basis = []
    # 1. Fragmentation buckets (from v1, now as ranges)
    if fragmentation_index < 1.0:
        lo, hi, label = 0.0, 4.0, "fresh"
    elif fragmentation_index < 5.0:
        lo, hi, label = 2.0, 12.0, "hours"
    elif fragmentation_index < 15.0:
        lo, hi, label = 8.0, 36.0, "day"
    else:
        lo, hi, label = 24.0, 96.0, "days"
    basis.append(f"fragmentation_index={fragmentation_index:.2f} → base bucket '{label}' ({lo:.0f}–{hi:.0f} h)")

    # 2. Elongation: very elongated slicks have had time to be stretched by wind/shear
    if elongation_ratio >= 6.0:
        lo, hi = lo + 2.0, hi * 1.25
        basis.append(f"elongation_ratio={elongation_ratio:.1f} (very streaky) → window shifted older")
    elif elongation_ratio <= 1.5 and label in ("fresh", "hours"):
        hi = max(lo + 1.0, hi * 0.8)
        basis.append(f"elongation_ratio={elongation_ratio:.1f} (compact) → window narrowed younger")

    # 3. Wind speed accelerates weathering
    if wind_speed_ms is not None:
        if wind_speed_ms > 9.0:
            lo, hi = lo * 0.6, hi * 0.7
            basis.append(f"wind {wind_speed_ms:.1f} m/s (strong) → faster weathering, window shifted younger")
        elif wind_speed_ms < 3.0:
            hi = hi * 1.2
            basis.append(f"wind {wind_speed_ms:.1f} m/s (calm) → slow weathering, window widened older")

    # 4. Backscatter contrast (dB-ish, 0-1 normalised) if caller provides it
    if mean_backscatter_contrast is not None:
        if mean_backscatter_contrast < 0.15:
            lo, hi = lo + 4.0, hi * 1.3
            basis.append(f"weak slick/sea contrast ({mean_backscatter_contrast:.2f}) → thinner/older oil")
        elif mean_backscatter_contrast > 0.45:
            hi = max(lo + 1.0, hi * 0.8)
            basis.append(f"strong slick/sea contrast ({mean_backscatter_contrast:.2f}) → thick/fresh oil")

    # 5. Fay spreading sanity check: gravity-viscous phase ~ A ∝ t^0.5. A >50 km² in
    #    under 4 h would require an implausibly large release, so widen upward.
    if area_sq_km > 50 and hi < 12:
        hi = 12.0
        basis.append(f"area {area_sq_km:.1f} km² too large for a <4 h slick (Fay spreading) → window widened")

    lo = max(0.0, round(lo, 1))
    hi = max(lo + 0.5, round(hi, 1))
    likely = round(lo + (hi - lo) * 0.45, 1)  # skewed slightly young: most detections are recent
    return AgeEstimate(label=label, hours_min=lo, hours_max=hi, hours_likely=likely, basis=basis)


def origin_time_window(capture_time: datetime, age: AgeEstimate) -> dict:
    """Turn (capture time, age range) into an origin-time window."""
    earliest = capture_time - timedelta(hours=age.hours_max)
    latest = capture_time - timedelta(hours=age.hours_min)
    likely = capture_time - timedelta(hours=age.hours_likely)
    return {
        "origin_time_earliest": earliest,
        "origin_time_latest": latest,
        "origin_time_likely": likely,
        "window_hours": round(age.hours_max - age.hours_min, 1),
        "human": (
            f"Released between {earliest.strftime('%H:%M')} and {latest.strftime('%H:%M %Z on %d %b %Y')}, "
            f"most likely around {likely.strftime('%H:%M')} "
            f"({age.hours_min:.0f}–{age.hours_max:.0f} h before the {capture_time.strftime('%H:%M')} SAR pass)."
        ),
    }


# --------------------------------------------------------------------------- #
# Wind physics gate (Improve 4)
# --------------------------------------------------------------------------- #

WIND_GATE_LOW_MS = 2.5    # below this calm water looks like oil (look-alike risk)
WIND_GATE_HIGH_MS = 10.0  # above this wind roughens the sea and erases the slick signature


def wind_gate(wind_speed_ms: Optional[float]) -> dict:
    """
    Classify detection confidence by wind speed at capture time.
    Oil is reliably visible on SAR roughly between 2–3 m/s and 7–12 m/s.
    """
    if wind_speed_ms is None:
        return {"status": "unknown", "wind_speed_ms": None,
                "note": "No wind field available at capture time — physics gate not applied."}
    if wind_speed_ms < WIND_GATE_LOW_MS:
        return {"status": "low_wind_lookalike_risk", "wind_speed_ms": round(wind_speed_ms, 2),
                "note": (f"Wind {wind_speed_ms:.1f} m/s is below {WIND_GATE_LOW_MS} m/s: calm-water patches, biogenic films "
                         "and low-wind zones mimic oil on SAR. Detection flagged LOW CONFIDENCE — needs a second pass or EO check.")}
    if wind_speed_ms > WIND_GATE_HIGH_MS:
        return {"status": "high_wind_signature_suppressed", "wind_speed_ms": round(wind_speed_ms, 2),
                "note": (f"Wind {wind_speed_ms:.1f} m/s exceeds {WIND_GATE_HIGH_MS} m/s: wind-roughened sea suppresses the slick "
                         "signature, so the slick may be under-detected. Area estimate is a lower bound.")}
    return {"status": "ok", "wind_speed_ms": round(wind_speed_ms, 2),
            "note": f"Wind {wind_speed_ms:.1f} m/s is inside the {WIND_GATE_LOW_MS}–{WIND_GATE_HIGH_MS} m/s band where oil is reliably visible on SAR."}


def slick_contrast(img: np.ndarray, oil_mask: np.ndarray) -> Optional[float]:
    """Normalised backscatter contrast between slick and surrounding sea (0..1)."""
    try:
        img = img.astype(np.float32)
        if oil_mask.sum() < 10 or (~oil_mask).sum() < 10:
            return None
        oil = float(np.median(img[oil_mask]))
        sea = float(np.median(img[~oil_mask]))
        rng = float(np.percentile(img, 99) - np.percentile(img, 1)) or 1.0
        return round(max(0.0, (sea - oil) / rng), 3)
    except Exception:
        return None
