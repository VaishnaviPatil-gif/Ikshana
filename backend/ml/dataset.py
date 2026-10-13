"""
PyTorch Dataset for Sentinel-1 SAR Oil Spill Segmentation (Zenodo dataset).
Handles: Part I (oil spills), Part II (look-alikes), Part III (test).
3-class: Oil=0, Look-alike=1, Sea=2
Single-band SAR sigma0-dB TIFFs, 2048x2048.
"""
import os
import numpy as np
try:
    import torch
    from torch.utils.data import Dataset
except ImportError:
    torch = None
    Dataset = object
import cv2


class SARSpillDataset(Dataset):
    """
    Expects directory structure:
        data/sar/
            images/
                img_001.tif
                img_002.tif
                ...
            masks/
                img_001.tif  (same name, mask with class indices)
                ...

    Masks should have pixel values: 0=Oil, 1=Look-alike, 2=Sea
    If raw Zenodo masks are binary (0/1), they are mapped based on the subfolder source.
    """

    def __init__(self, images_dir=None, masks_dir=None, manifest_path=None, transform=None, image_size=512):
        import json
        self.transform = transform
        self.image_size = image_size
        self.pairs = []

        # If manifest_path is provided (e.g. data/sar/splits/train.json)
        if manifest_path and os.path.exists(manifest_path):
            with open(manifest_path, "r") as f:
                records = json.load(f)
            for r in records:
                cat = "spill" if r.get("label") == "oil" else r.get("label", "no_oil")
                self.pairs.append((r["full_image_path"], r["full_mask_path"], cat))
            print(f"[*] Loaded {len(self.pairs)} image-mask pairs from manifest: {manifest_path}")
            return

        # Auto-resolve directory names if case or singular/plural differs
        def resolve_dir(d, candidates):
            if d and os.path.exists(d):
                return d
            parent = os.path.dirname(d) if d else "."
            for cand in candidates:
                cand_p = os.path.join(parent, cand)
                if os.path.exists(cand_p):
                    return cand_p
            return d

        self.images_dir = resolve_dir(images_dir, ["Images", "images", "image", "sar_images"]) if images_dir else None
        self.masks_dir = resolve_dir(masks_dir, ["Mask", "masks", "mask", "Labels", "labels"]) if masks_dir else None

        valid_exts = ('.tif', '.tiff', '.png', '.jpg', '.jpeg')

        # Build mask lookup index
        # Maps both full relative path and normalized filename without _segmentation/_mask
        mask_map = {}
        if os.path.exists(self.masks_dir):
            for root, _, files in os.walk(self.masks_dir):
                for f in files:
                    if f.lower().endswith(valid_exts):
                        full_p = os.path.join(root, f)
                        f_lower = f.lower()
                        stem = os.path.splitext(f_lower)[0]
                        clean_stem = stem.replace("_segmentation", "").replace("_mask", "").replace("_label", "")
                        
                        mask_map[f_lower] = full_p
                        mask_map[stem] = full_p
                        mask_map[clean_stem] = full_p
                        mask_map[clean_stem + os.path.splitext(f_lower)[1]] = full_p

                        rel_p = os.path.relpath(full_p, self.masks_dir).replace("\\", "/").lower()
                        rel_clean = rel_p.replace("_segmentation", "").replace("_mask", "").replace("_label", "")
                        mask_map[rel_p] = full_p
                        mask_map[rel_clean] = full_p

        # Walk images_dir and pair with corresponding mask
        if os.path.exists(self.images_dir):
            for root, _, files in os.walk(self.images_dir):
                for f in files:
                    if f.lower().endswith(valid_exts):
                        img_path = os.path.join(root, f)
                        f_lower = f.lower()
                        stem = os.path.splitext(f_lower)[0]
                        rel_img = os.path.relpath(img_path, self.images_dir).replace("\\", "/").lower()

                        matched_mask = (
                            mask_map.get(rel_img) or 
                            mask_map.get(f_lower) or 
                            mask_map.get(stem)
                        )

                        if matched_mask and os.path.exists(matched_mask):
                            # Infer category from folder names for Zenodo label mapping
                            path_lower = img_path.lower()
                            if "lookalike" in path_lower:
                                cat = "lookalike"
                            elif "no oil" in path_lower or "no_oil" in path_lower:
                                cat = "no_oil"
                            else:
                                cat = "spill"
                            self.pairs.append((img_path, matched_mask, cat))

        if not self.pairs:
            print(f"[WARN] No matching image-mask pairs found in {self.images_dir} and {self.masks_dir}")
        else:
            print(f"[*] Found {len(self.pairs)} matching SAR image/mask pairs across subfolders.")

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, idx):
        img_path, mask_path, category = self.pairs[idx]

        # Read image (handles float32 SAR TIFFs via tifffile, rasterio, or cv2)
        image = None
        if img_path.lower().endswith(('.tif', '.tiff')):
            try:
                import tifffile
                image = tifffile.imread(img_path)
            except Exception:
                pass
        if image is None:
            image = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
        if image is None:
            try:
                import rasterio
                with rasterio.open(img_path) as src:
                    image = src.read(1)
            except Exception:
                raise ValueError(f"Could not read image: {img_path}")

        # Read mask
        mask = None
        if mask_path.lower().endswith(('.tif', '.tiff')):
            try:
                import tifffile
                mask = tifffile.imread(mask_path)
            except Exception:
                pass
        if mask is None:
            mask = cv2.imread(mask_path, cv2.IMREAD_UNCHANGED)
        if mask is None:
            try:
                import rasterio
                with rasterio.open(mask_path) as src:
                    mask = src.read(1)
            except Exception:
                raise ValueError(f"Could not read mask: {mask_path}")

        # If multi-channel/dual-polarization, select primary channel (e.g. VV)
        if image.ndim == 3:
            image = image[..., 0]
        if mask.ndim == 3:
            mask = mask[..., 0]

        # Resize to target size
        image = cv2.resize(image, (self.image_size, self.image_size), interpolation=cv2.INTER_LINEAR)
        mask = cv2.resize(mask, (self.image_size, self.image_size), interpolation=cv2.INTER_NEAREST)
        image = np.squeeze(image)
        mask = np.squeeze(mask)

        # Normalize image to [0, 1]
        if image.dtype != np.float32:
            image = image.astype(np.float32)
        img_min, img_max = image.min(), image.max()
        if img_max > img_min:
            image = (image - img_min) / (img_max - img_min)
        else:
            image = np.zeros_like(image)

        # Ensure correct class mapping for Zenodo labels: 0=Oil, 1=Lookalike, 2=Sea
        raw_unique = set(np.unique(mask))
        if raw_unique.issubset({0, 255}) or raw_unique.issubset({0, 1}):
            # Binary mask: map to 3-class system
            fg = (mask == 255) | (mask == 1)
            new_mask = np.full_like(mask, fill_value=2, dtype=np.int64)  # default: Sea (2)
            if category == "spill":
                new_mask[fg] = 0  # Oil (0)
            elif category == "lookalike":
                new_mask[fg] = 1  # Look-alike (1)
            mask = new_mask
        else:
            mask = np.clip(mask.astype(np.int64), 0, 2)

        if torch is not None:
            image_tensor = torch.from_numpy(image).unsqueeze(0)
            mask_tensor = torch.from_numpy(mask).long()
            return image_tensor, mask_tensor
        return image, mask


def create_demo_dataset(output_dir, num_samples=20, image_size=512):
    """Generate synthetic SAR-like images and masks for demo/testing when real data is unavailable."""
    os.makedirs(os.path.join(output_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(output_dir, "masks"), exist_ok=True)

    for i in range(num_samples):
        # Create synthetic SAR-like image (dark sea, bright features)
        image = np.random.normal(-20, 3, (image_size, image_size)).astype(np.float32)

        # Create mask (mostly sea)
        mask = np.full((image_size, image_size), 2, dtype=np.uint8)  # Sea

        # Add oil spill region (dark, smooth)
        if i % 3 == 0:  # Oil spill
            cx, cy = np.random.randint(100, 400, 2)
            axes = np.random.randint(30, 100, 2)
            angle = np.random.randint(0, 180)
            cv2.ellipse(mask, (cx, cy), tuple(axes), angle, 0, 360, 0, -1)
            cv2.ellipse(image, (cx, cy), tuple(axes), angle, 0, 360, -28, -1)
            # Add noise to oil region
            oil_mask = mask == 0
            image[oil_mask] += np.random.normal(0, 0.5, oil_mask.sum()).astype(np.float32)

        elif i % 3 == 1:  # Look-alike
            cx, cy = np.random.randint(100, 400, 2)
            axes = np.random.randint(20, 80, 2)
            angle = np.random.randint(0, 180)
            cv2.ellipse(mask, (cx, cy), tuple(axes), angle, 0, 360, 1, -1)
            cv2.ellipse(image, (cx, cy), tuple(axes), angle, 0, 360, -24, -1)

        # Save
        fname = f"sample_{i:04d}.png"
        cv2.imwrite(os.path.join(output_dir, "images", fname), 
                     ((image + 30) / 30 * 255).clip(0, 255).astype(np.uint8))
        cv2.imwrite(os.path.join(output_dir, "masks", fname), mask)

    print(f"Created {num_samples} synthetic SAR samples in {output_dir}")
