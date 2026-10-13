# ML Model Checkpoints

This directory contains the trained neural network model weights for SAR oil spill segmentation:

- `unet_best.pth` (~54.7 MB): PyTorch U-Net model with ResNet encoder trained on Sentinel-1 SAR imagery for 3-class segmentation:
  - Class 0: Oil Slick
  - Class 1: Look-alike (algal bloom, biogenic film, low-wind zone)
  - Class 2: Background Sea
- `training_metrics.json`: Epoch loss, IoU, and validation metrics history.

### Inference
This model is automatically loaded by `ml/predict.py` when evaluating SAR images uploaded via the UI or CLI.