# Optimization Report

Date: 2026-05-28

## Changes Applied

- Enabled R8 minification and Android resource shrinking for release.
- Switched release ProGuard config to `proguard-android-optimize.txt`.
- Disabled release native debug symbols.
- Restricted React Native architectures to `arm64-v8a`.
- Enabled ABI splits and disabled universal APK output.
- Added metadata resource excludes.
- Disabled unused VisionCamera code-scanner packaging while keeping frame processors.
- Changed TFLite runtime delegate priority to NNAPI, CPU, then GPU only in debug.
- Excluded `libtensorflowlite_gpu_jni.so` from release only.
- Removed duplicate direct Android asset copies of the bundled TFLite models.
- Removed unused direct npm packages: `@react-native/new-app-screen`, `react-native-nitro-image`, `react-native-permissions`, and redundant direct `react-native-screens`.

## Preserved Capabilities

- Realtime camera preview and frame processors remain enabled.
- TFLite CPU/NNAPI path remains packaged.
- MobileFaceNet and BlazeFace local models remain bundled for offline operation.
- SQLCipher code path remains unchanged.
- Offline sync/PostgreSQL sync code paths were not removed.
- Security hardening and APK integrity code paths were not removed.

## High-Risk Decisions

| Area | Decision | Rationale |
| --- | --- | --- |
| GPU delegate | Removed from release package only; debug still keeps GPU fallback | Release runtime now avoids GPU. This saves size and avoids thermal risk, but physical-device NNAPI/CPU performance must be validated. |
| VisionCamera code scanner | Disabled | App code does not use `codeScanner`, barcode, or scan APIs. Frame processors remain enabled. |
| SQLCipher | Kept | Removing SQLCipher would weaken local database-at-rest protection. |
| Cloud model delivery | Not implemented | Offline authentication is required. Cloud-only delivery would break first-run/offline expectations. |
| INT8 model conversion | Not generated | Requires representative calibration data and accuracy validation. |

## Remaining Opportunities

- Quantize MobileFaceNet and BlazeFace with representative calibration data.
- Add secure model manager only if product accepts first-launch download and offline fallback complexity.
- Evaluate a smaller face recognition model.
- Investigate why MLKit barcode property files remain after native removal; impact is tiny.
- Run release on a real arm64 device and compare NNAPI/CPU latency against old GPU behavior.
