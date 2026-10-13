"""
U-Net Training Script for SAR Oil Spill Detection

This script trains a U-Net model with a ResNet34 encoder using the
segmentation_models_pytorch (smp) library. 

Usage:
    # Train on real dataset
    python ml/train.py --data_dir /path/to/dataset --epochs 50 --batch_size 16

    # Run in demo mode (generates tiny synthetic dataset and trains for 5 epochs)
    python ml/train.py --demo
"""

import os
import argparse
import numpy as np
import cv2
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split
import segmentation_models_pytorch as smp
from tqdm import tqdm

class SARDataset(Dataset):
    def __init__(self, images_dir, masks_dir):
        self.images_dir = images_dir
        self.masks_dir = masks_dir
        self.images = sorted(os.listdir(images_dir))
        
    def __len__(self):
        return len(self.images)
        
    def __getitem__(self, idx):
        img_name = self.images[idx]
        img_path = os.path.join(self.images_dir, img_name)
        mask_path = os.path.join(self.masks_dir, img_name)
        
        # Load grayscale image and convert to 3 channels (expected by ResNet)
        image = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
        image = cv2.resize(image, (256, 256))
        image = np.stack((image,)*3, axis=-1)
        image = image.transpose(2, 0, 1).astype('float32') / 255.0
        
        # Load mask (0 for background, 1 for oil)
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        mask = cv2.resize(mask, (256, 256), interpolation=cv2.INTER_NEAREST)
        mask = (mask > 0).astype('float32')
        mask = np.expand_dims(mask, axis=0)
        
        return torch.tensor(image), torch.tensor(mask)


class BCEDiceLoss(nn.Module):
    def __init__(self, bce_weight=0.5):
        super(BCEDiceLoss, self).__init__()
        self.bce_weight = bce_weight
        self.bce = nn.BCEWithLogitsLoss()
        
    def forward(self, inputs, targets, smooth=1):
        bce = self.bce(inputs, targets)
        inputs = torch.sigmoid(inputs)
        
        inputs = inputs.view(-1)
        targets = targets.view(-1)
        intersection = (inputs * targets).sum()
        dice = 1 - (2.*intersection + smooth) / (inputs.sum() + targets.sum() + smooth)
        
        return self.bce_weight * bce + (1 - self.bce_weight) * dice


def generate_demo_dataset(data_dir):
    print("Generating synthetic demo dataset...")
    images_dir = os.path.join(data_dir, "images")
    masks_dir = os.path.join(data_dir, "masks")
    os.makedirs(images_dir, exist_ok=True)
    os.makedirs(masks_dir, exist_ok=True)
    
    for i in range(10):
        # Create a noisy background (sea)
        img = np.random.randint(100, 150, (256, 256), dtype=np.uint8)
        mask = np.zeros((256, 256), dtype=np.uint8)
        
        # Add a dark blob (oil spill)
        center_x = np.random.randint(50, 200)
        center_y = np.random.randint(50, 200)
        axes = (np.random.randint(20, 40), np.random.randint(10, 20))
        angle = np.random.randint(0, 180)
        
        cv2.ellipse(mask, (center_x, center_y), axes, angle, 0, 360, 255, -1)
        
        # Apply dark blob to image
        img[mask == 255] = np.random.randint(30, 80, size=(mask == 255).sum())
        
        # Blur a bit
        img = cv2.GaussianBlur(img, (5, 5), 0)
        
        cv2.imwrite(os.path.join(images_dir, f"demo_{i}.png"), img)
        cv2.imwrite(os.path.join(masks_dir, f"demo_{i}.png"), mask)


def main():
    parser = argparse.ArgumentParser(description="Train U-Net for SAR Oil Spill Detection")
    parser.add_argument('--data_dir', type=str, default="data/sar_dataset", help="Dataset directory")
    parser.add_argument('--epochs', type=int, default=50, help="Number of epochs")
    parser.add_argument('--batch_size', type=int, default=16, help="Batch size")
    parser.add_argument('--lr', type=float, default=1e-4, help="Learning rate")
    parser.add_argument('--demo', action='store_true', help="Run demo with synthetic dataset")
    args = parser.parse_args()
    
    if args.demo:
        generate_demo_dataset("data/demo_dataset")
        args.data_dir = "data/demo_dataset"
        args.epochs = 5
        args.batch_size = 2
        
    images_dir = os.path.join(args.data_dir, "images")
    masks_dir = os.path.join(args.data_dir, "masks")
    
    if not os.path.exists(images_dir) or not os.path.exists(masks_dir):
        raise ValueError("Data directory must contain 'images' and 'masks' subdirectories.")
        
    dataset = SARDataset(images_dir, masks_dir)
    val_size = max(1, int(0.2 * len(dataset)))
    train_size = len(dataset) - val_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    model = smp.Unet(
        encoder_name="resnet34",
        encoder_weights="imagenet",
        in_channels=3,
        classes=1,
    )
    model.to(device)
    
    criterion = BCEDiceLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    
    checkpoints_dir = "ml/checkpoints"
    os.makedirs(checkpoints_dir, exist_ok=True)
    best_model_path = os.path.join(checkpoints_dir, "unet_best.pth")
    
    best_loss = float('inf')
    
    for epoch in range(args.epochs):
        model.train()
        train_loss = 0.0
        
        for images, masks in tqdm(train_loader, desc=f"Epoch {epoch+1}/{args.epochs} [Train]"):
            images, masks = images.to(device), masks.to(device)
            
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, masks)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
            
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for images, masks in tqdm(val_loader, desc=f"Epoch {epoch+1}/{args.epochs} [Val]"):
                images, masks = images.to(device), masks.to(device)
                outputs = model(images)
                loss = criterion(outputs, masks)
                val_loss += loss.item()
                
        train_loss /= len(train_loader)
        val_loss /= len(val_loader)
        print(f"Epoch {epoch+1}: Train Loss = {train_loss:.4f}, Val Loss = {val_loss:.4f}")
        
        if val_loss < best_loss:
            best_loss = val_loss
            torch.save(model.state_dict(), best_model_path)
            print(f"Best model saved to {best_model_path}")
            
    print("Training complete.")

if __name__ == "__main__":
    main()
