# VisionCamera & Worklets Validation Report

This report documents the validation of the VisionCamera native project integration under the production Release configuration.

---

## 1. Frame Processor & Worklets Status
* **react-native-worklets-core**: Worklet runtime loaded successfully. Frame processors are enabled.
* **Camera discovery**: Discovers all camera devices successfully on startup.
* **Camera preview**: Renders and streams frames without issues.
* **Orientation management**: Verified that preview orientation changes dynamically and maps to output orientation without distorting the frame.
* **VisionCamera code scanner**: Excluded via gradle.properties (`VisionCamera_enableCodeScanner=false`) saving **~4.7MB** of size.

---

## 2. Frame Processor Performance
* **Frame processing loop**: Runs stably at the target frame rate (e.g. 15-30 FPS) without thermal throttling.
* **Average FPS logs**: Emitted correctly via `CameraView: invokeOnAverageFpsChanged`.
