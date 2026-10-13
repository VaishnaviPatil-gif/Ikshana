from pathlib import Path
import cv2
import numpy as np
import pytest

from ml.predict import CLASS_NAMES, extract_oil_polygons, characterize_geometry


def test_unet_class_names_maps_sea_to_no_oil():
    """Verify class 2 is explicitly 'No oil' instead of 'Sea'."""
    assert CLASS_NAMES[2] == "No oil"
    assert CLASS_NAMES[0] == "Oil"
    assert CLASS_NAMES[1] == "Look-alike"


def test_clean_sea_scenes_exist_and_are_valid():
    """Verify the 2 clean-sea demo scenes and their ground truth masks."""
    base_dir = Path(__file__).resolve().parent.parent / "data" / "sar" / "demo_for_judges"
    offshore = base_dir / "demo_clean_sea_offshore.png"
    offshore_gt = base_dir / "demo_clean_sea_offshore_ground_truth_mask.png"
    corridor = base_dir / "demo_clean_sea_shipping_corridor.png"
    corridor_gt = base_dir / "demo_clean_sea_shipping_corridor_ground_truth_mask.png"

    assert offshore.exists(), f"Missing {offshore}"
    assert corridor.exists(), f"Missing {corridor}"

    img_off = cv2.imread(str(offshore), cv2.IMREAD_GRAYSCALE)
    assert img_off is not None and img_off.shape[0] > 0

    img_corr = cv2.imread(str(corridor), cv2.IMREAD_GRAYSCALE)
    assert img_corr is not None and img_corr.shape[0] > 0

    if offshore_gt.exists():
        gt_off = cv2.imread(str(offshore_gt), cv2.IMREAD_GRAYSCALE)
        assert np.all(gt_off != 1) and np.all(gt_off != 255), "Clean sea ground truth should have no oil pixels"

    if corridor_gt.exists():
        gt_corr = cv2.imread(str(corridor_gt), cv2.IMREAD_GRAYSCALE)
        assert np.all(gt_corr != 1) and np.all(gt_corr != 255), "Corridor clean sea should have no oil pixels"


def test_characterize_geometry_on_clean_sea_empty_mask():
    """Empty mask (all sea / No oil) yields no polygons and zero oil area."""
    empty_mask = np.full((256, 256), 2, dtype=np.uint8)  # all class 2 (No oil)
    poly = extract_oil_polygons(empty_mask, class_id=0)
    assert poly is None
    features = characterize_geometry(poly, pixel_size_m=50.0)
    assert features["area_sq_km"] == 0.0
    assert features["perimeter_km"] == 0.0
    assert features["age_estimate"] == "unknown"


def test_oil_sample_invariants():
    """Verify that an oil sample yields Oil class, matching confidence, and argmax dominance."""
    from app.spills.detection_physics import compute_physics_confidence
    features = {
        "contrast_db": 6.36,
        "edge_sharpness": 183.42,
        "elongation_ratio": 9.88,
        "shape_complexity": 0.412,
        "area_sq_km": 39.42,
        "interior_std": 5.38,
    }
    raw_probs = {"oil": 0.88, "lookalike": 0.08, "sea": 0.04}
    res = compute_physics_confidence(raw_probs, features, wind_speed_ms=5.5)

    assert res["final_class"] == "Oil"
    final_probs = res["final_probabilities"]

    # Invariant 1: sum to 1.0
    assert abs(sum(final_probs.values()) - 1.0) < 1e-4

    # Invariant 2: final_class == argmax(final_probabilities)
    argmax_key = max(final_probs, key=final_probs.get)
    assert argmax_key == "oil"

    # Invariant 3: confidence == final_probabilities[final_class]
    assert abs(res["final_confidence"] - final_probs["oil"]) < 1e-4
    assert res["final_confidence"] > 0.80

    # Invariant 4: No false lookalike cause
    assert res["lookalike_cause"] is None


def test_lookalike_sample_invariants():
    """Verify that a lookalike sample yields Look-alike class, matching confidence, and argmax dominance."""
    from app.spills.detection_physics import compute_physics_confidence
    features = {
        "contrast_db": 5.56,
        "edge_sharpness": 40.25,
        "elongation_ratio": 1.24,
        "shape_complexity": 0.995,
        "area_sq_km": 66.60,
        "interior_std": 11.01,
    }
    raw_probs = {"oil": 0.15, "lookalike": 0.75, "sea": 0.10}
    res = compute_physics_confidence(raw_probs, features, wind_speed_ms=2.1)

    assert res["final_class"] == "Look-alike"
    final_probs = res["final_probabilities"]

    # Invariant 1: sum to 1.0
    assert abs(sum(final_probs.values()) - 1.0) < 1e-4

    # Invariant 2: final_class == argmax(final_probabilities)
    argmax_key = max(final_probs, key=final_probs.get)
    assert argmax_key == "lookalike"

    # Invariant 3: confidence == final_probabilities[final_class]
    assert abs(res["final_confidence"] - final_probs["lookalike"]) < 1e-4
    assert res["final_confidence"] > 0.50

    # Invariant 4: Low wind cause identified correctly with numerical values
    assert "2.1 m/s" in res["lookalike_cause"]
    assert "Low wind" in res["lookalike_cause"]


def test_clean_sea_sample_invariants():
    """Verify that a clean sea scene yields No oil class and sea dominance."""
    from app.spills.detection_physics import compute_physics_confidence
    features = {
        "contrast_db": 0.0,
        "edge_sharpness": 0.0,
        "elongation_ratio": 1.0,
        "shape_complexity": 1.0,
        "area_sq_km": 0.0,
        "interior_std": 0.0,
    }
    raw_probs = {"oil": 0.05, "lookalike": 0.02, "sea": 0.93}
    res = compute_physics_confidence(raw_probs, features, wind_speed_ms=6.0)

    assert res["final_class"] == "No oil"
    final_probs = res["final_probabilities"]

    # Invariant 1: sum to 1.0
    assert abs(sum(final_probs.values()) - 1.0) < 1e-4

    # Invariant 2: final_class == argmax(final_probabilities)
    argmax_key = max(final_probs, key=final_probs.get)
    assert argmax_key == "sea"

    # Invariant 3: confidence == final_probabilities[final_class]
    assert abs(res["final_confidence"] - final_probs["sea"]) < 1e-4


def test_no_wind_contradiction_when_wind_is_optimal():
    """Verify that when wind is 5.5 m/s, lookalike cause does NOT say wind < 2.5 m/s."""
    from app.spills.detection_physics import compute_physics_confidence
    features = {
        "contrast_db": 1.2,
        "edge_sharpness": 5.0,
        "elongation_ratio": 1.1,
        "shape_complexity": 0.9,
        "area_sq_km": 2.0,
        "interior_std": 3.0,
    }
    raw_probs = {"oil": 0.20, "lookalike": 0.70, "sea": 0.10}
    res = compute_physics_confidence(raw_probs, features, wind_speed_ms=5.5)

    assert res["final_class"] == "Look-alike"
    if res["lookalike_cause"]:
        assert "<" not in res["lookalike_cause"]
        assert "Low wind" not in res["lookalike_cause"]


def test_real_pipeline_on_both_provided_demo_files():
    """Run the real inference & physics pipeline on the 2 actual files and verify decisions."""
    from app.spills.detection_physics import extract_sar_features, compute_physics_confidence
    from ml.predict import load_model, predict_mask
    import os

    backend_dir = Path(__file__).resolve().parent.parent
    model_path = backend_dir / "ml" / "models" / "unet_best.pth"
    model, img_size = load_model(str(model_path))

    # 1. Real Oil Sample
    oil_path = backend_dir / "data" / "sar" / "demo_oil_spill_moderate.png"
    img_oil = cv2.imread(str(oil_path), cv2.IMREAD_GRAYSCALE)
    pred_oil, probs_oil = predict_mask(model, img_oil, image_size=img_size)
    blurred_oil = cv2.GaussianBlur(img_oil, (5, 5), 0)
    _, thresh_oil = cv2.threshold(blurred_oil, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    feats_oil = extract_sar_features(img_oil, thresh_oil > 0)
    h_p, w_p = probs_oil.shape[1], probs_oil.shape[2]
    mask_res_oil = cv2.resize((thresh_oil > 0).astype(np.uint8), (w_p, h_p), interpolation=cv2.INTER_NEAREST) > 0
    p0 = float(probs_oil[0][mask_res_oil].mean())
    p1 = float(probs_oil[1][mask_res_oil].mean())
    p2 = float(probs_oil[2][mask_res_oil].mean())
    tot_p = max(1e-6, p0 + p1 + p2)
    res_oil = compute_physics_confidence({"oil": p0/tot_p, "lookalike": p1/tot_p, "sea": p2/tot_p}, feats_oil, wind_speed_ms=5.5)

    assert res_oil["final_class"] == "Oil"
    assert res_oil["final_confidence"] == res_oil["final_probabilities"]["oil"]
    assert max(res_oil["final_probabilities"], key=res_oil["final_probabilities"].get) == "oil"
    assert abs(sum(res_oil["final_probabilities"].values()) - 1.0) < 1e-4

    # 2. Real Look-alike Sample
    look_path = backend_dir / "data" / "sar" / "demo_lookalike_low_wind.png"
    img_look = cv2.imread(str(look_path), cv2.IMREAD_GRAYSCALE)
    pred_look, probs_look = predict_mask(model, img_look, image_size=img_size)
    blurred_look = cv2.GaussianBlur(img_look, (5, 5), 0)
    _, thresh_look = cv2.threshold(blurred_look, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    feats_look = extract_sar_features(img_look, thresh_look > 0)
    mask_res_look = cv2.resize((thresh_look > 0).astype(np.uint8), (w_p, h_p), interpolation=cv2.INTER_NEAREST) > 0
    p0_l = float(probs_look[0][mask_res_look].mean())
    p1_l = float(probs_look[1][mask_res_look].mean())
    p2_l = float(probs_look[2][mask_res_look].mean())
    tot_p_l = max(1e-6, p0_l + p1_l + p2_l)
    res_look = compute_physics_confidence({"oil": p0_l/tot_p_l, "lookalike": p1_l/tot_p_l, "sea": p2_l/tot_p_l}, feats_look, wind_speed_ms=5.5)

    assert res_look["final_class"] == "Look-alike"
    assert res_look["final_confidence"] == res_look["final_probabilities"]["lookalike"]
    assert max(res_look["final_probabilities"], key=res_look["final_probabilities"].get) == "lookalike"
    assert abs(sum(res_look["final_probabilities"].values()) - 1.0) < 1e-4
