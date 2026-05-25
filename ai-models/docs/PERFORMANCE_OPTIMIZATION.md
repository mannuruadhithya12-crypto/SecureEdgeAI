# Performance Optimization Details

- **Hardware Acceleration**: Models use NNAPI on Android.
- **Selective Inference**: High-frequency tracking (BlazeFace Front) and low-frequency recognition (MobileFaceNet).
- **Worklets**: Native background threads for frame processing.
- **Low-Latency**: TFLite GPU delegate optimization.
