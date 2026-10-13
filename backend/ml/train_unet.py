"""
U-Net Training Script for 3-class SAR Oil Spill Segmentation.
Uses segmentation-models-pytorch with ResNet encoder on the authentic Zenodo SAR dataset.

Classes: Oil (0), Look-alike (1), Sea (2)

Usage:
    python -m ml.train_unet --train_manifest data/sar/splits/train.json --val_manifest data/sar/splits/val.json --epochs 10
"""
import os
import json
import argparse
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
import segmentation_models_pytorch as smp

from ml.dataset import SARSpillDataset


def get_model(in_channels=1, classes=3, encoder="resnet18"):
    """Create U-Net with pretrained encoder."""
    model = smp.Unet(
        encoder_name=encoder,
        encoder_weights="imagenet",
        in_channels=in_channels,
        classes=classes,
        activation=None,  # CrossEntropyLoss expects raw logits
    )
    return model


def compute_iou(preds, targets, num_classes=3):
    """Compute per-class and mean Intersection-over-Union."""
    ious = []
    for cls in range(num_classes):
        pred_cls = (preds == cls)
        target_cls = (targets == cls)
        intersection = (pred_cls & target_cls).sum().item()
        union = (pred_cls | target_cls).sum().item()
        if union == 0:
            ious.append(1.0)
        else:
            ious.append(intersection / union)
    return ious, float(np.mean(ious))


def train_one_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss = 0
    correct_pixels = 0
    total_pixels = 0

    for images, masks in loader:
        images = images.to(device)
        masks = masks.to(device)

        optimizer.zero_grad()
        outputs = model(images)  # [B, 3, H, W]
        loss = criterion(outputs, masks)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * images.size(0)
        preds = outputs.argmax(dim=1)
        correct_pixels += (preds == masks).sum().item()
        total_pixels += masks.numel()

    avg_loss = total_loss / len(loader.dataset)
    accuracy = correct_pixels / max(total_pixels, 1)
    return avg_loss, accuracy


def validate(model, loader, criterion, device):
    model.eval()
    total_loss = 0
    correct_pixels = 0
    total_pixels = 0
    all_oil_ious = []
    all_mean_ious = []

    with torch.no_grad():
        for images, masks in loader:
            images = images.to(device)
            masks = masks.to(device)

            outputs = model(images)
            loss = criterion(outputs, masks)

            total_loss += loss.item() * images.size(0)
            preds = outputs.argmax(dim=1)
            correct_pixels += (preds == masks).sum().item()
            total_pixels += masks.numel()

            ious, m_iou = compute_iou(preds, masks)
            all_oil_ious.append(ious[0])  # class 0 = Oil
            all_mean_ious.append(m_iou)

    avg_loss = total_loss / len(loader.dataset)
    accuracy = correct_pixels / max(total_pixels, 1)
    oil_iou = float(np.mean(all_oil_ious))
    mean_iou = float(np.mean(all_mean_ious))
    return avg_loss, accuracy, oil_iou, mean_iou


def main():
    parser = argparse.ArgumentParser(description="Train U-Net for SAR oil spill segmentation")
    parser.add_argument("--train_manifest", type=str, default="data/sar/splits/train.json", help="Path to train split JSON manifest")
    parser.add_argument("--val_manifest", type=str, default="data/sar/splits/val.json", help="Path to val split JSON manifest")
    parser.add_argument("--output_dir", type=str, default="ml/models", help="Model output directory")
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch_size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--image_size", type=int, default=256)
    parser.add_argument("--encoder", type=str, default="resnet18")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Using device: {device}")

    # Resolve manifest paths relative to backend root
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    train_mf = os.path.join(base_dir, args.train_manifest) if not os.path.isabs(args.train_manifest) else args.train_manifest
    val_mf = os.path.join(base_dir, args.val_manifest) if not os.path.isabs(args.val_manifest) else args.val_manifest
    out_dir = os.path.join(base_dir, args.output_dir) if not os.path.isabs(args.output_dir) else args.output_dir

    print(f"[*] Loading training set from: {train_mf}")
    train_dataset = SARSpillDataset(manifest_path=train_mf, image_size=args.image_size)
    print(f"[*] Loading validation set from: {val_mf}")
    val_dataset = SARSpillDataset(manifest_path=val_mf, image_size=args.image_size)

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False, num_workers=0)

    print(f"[*] Dataset: Train={len(train_dataset)} pairs | Val={len(val_dataset)} pairs")

    # Build model
    print(f"[*] Building U-Net with {args.encoder} encoder...")
    model = get_model(in_channels=1, classes=3, encoder=args.encoder).to(device)

    # Weighted CrossEntropy Loss (Oil=3.0, Lookalike=2.0, Sea=1.0)
    class_weights = torch.tensor([3.0, 2.0, 1.0], dtype=torch.float32).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3, factor=0.5)

    os.makedirs(out_dir, exist_ok=True)
    best_val_loss = float("inf")
    best_metrics = {}

    history = []
    print(f"\n[*] Starting training for {args.epochs} epochs (batch_size={args.batch_size}, size={args.image_size}x{args.image_size})...\n")

    for epoch in range(args.epochs):
        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, oil_iou, mean_iou = validate(model, val_loader, criterion, device)
        scheduler.step(val_loss)

        epoch_stat = {
            "epoch": epoch + 1,
            "train_loss": round(train_loss, 4),
            "train_acc": round(train_acc, 4),
            "val_loss": round(val_loss, 4),
            "val_acc": round(val_acc, 4),
            "oil_iou": round(oil_iou, 4),
            "mean_iou": round(mean_iou, 4),
        }
        history.append(epoch_stat)

        print(
            f"Epoch {epoch+1:02d}/{args.epochs:02d} | "
            f"Train Loss: {train_loss:.4f} Acc: {train_acc*100:.1f}% | "
            f"Val Loss: {val_loss:.4f} Acc: {val_acc*100:.1f}% | "
            f"Oil IoU: {oil_iou:.4f} mIoU: {mean_iou:.4f}"
        )

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_metrics = epoch_stat
            save_path = os.path.join(out_dir, "unet_best.pth")
            torch.save({
                "epoch": epoch + 1,
                "model_state_dict": model.state_dict(),
                "val_loss": val_loss,
                "val_acc": val_acc,
                "oil_iou": oil_iou,
                "mean_iou": mean_iou,
                "encoder": args.encoder,
                "image_size": args.image_size,
                "classes": 3,
                "class_names": {0: "Oil", 1: "Look-alike", 2: "Sea"}
            }, save_path)
            print(f"  --> Saved best model checkpoint to {save_path} (val_loss={val_loss:.4f})")

    # Save metrics JSON
    metrics_path = os.path.join(out_dir, "training_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump({
            "best_epoch": best_metrics,
            "history": history,
            "encoder": args.encoder,
            "image_size": args.image_size,
            "num_train_samples": len(train_dataset),
            "num_val_samples": len(val_dataset),
            "classes": ["Oil", "Look-alike", "Sea"]
        }, f, indent=2)

    print(f"\n[SUCCESS] Model training complete!")
    print(f"          Best Val Accuracy: {best_metrics.get('val_acc', 0)*100:.2f}% | Best Oil IoU: {best_metrics.get('oil_iou', 0):.4f}")
    print(f"          Checkpoint: {os.path.join(out_dir, 'unet_best.pth')}")
    print(f"          Metrics: {metrics_path}\n")


if __name__ == "__main__":
    main()
