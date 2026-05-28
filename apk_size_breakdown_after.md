# APK Size Breakdown After Optimization

Date: 2026-05-28
Artifact: `android/app/build/outputs/apk/release/app-arm64-v8a-release.apk`
APK size: 30.17 MB
AAB size: 37.75 MB

## Top-Level APK Groups

| Group | Size | Count |
| --- | ---: | ---: |
| `lib` | 19.85 MB | 20 |
| `res` | 6.12 MB | 398 |
| `classes.dex` | 4.13 MB | 1 |
| `assets` | 1.61 MB | 3 |
| `resources.arsc` | 0.53 MB | 1 |

## ABI Distribution

| ABI | Native Size | Native Libraries |
| --- | ---: | ---: |
| arm64-v8a | 19.85 MB | 20 |

## Largest Entries

| Entry | Size |
| --- | ---: |
| `lib/arm64-v8a/libreactnative.so` | 6.76 MB |
| `res/ag.tflite` | 5.23 MB |
| `lib/arm64-v8a/libtensorflowlite_jni.so` | 4.32 MB |
| `classes.dex` | 4.13 MB |
| `lib/arm64-v8a/libhermesvm.so` | 2.46 MB |
| `assets/index.android.bundle` | 1.61 MB |
| `lib/arm64-v8a/libc++_shared.so` | 1.29 MB |
| `lib/arm64-v8a/libNitroModules.so` | 0.98 MB |

## Major Component Contributions

| Component | Size | Count | Status |
| --- | ---: | ---: | --- |
| TensorFlow Lite CPU JNI | 4.12 MB | 1 | Kept |
| TensorFlow Lite GPU JNI | 0 MB | 0 | Removed from release only |
| MLKit/Barhopper code scanner | 0 MB | 0 | Removed by disabling unused VisionCamera code scanner |
| React Native native runtime | 6.45 MB | 1 | Kept |
| Hermes | 2.48 MB | 2 | Kept |
| VisionCamera native libs | 0.83 MB | 2 | Kept |
| Worklets | 0.48 MB | 1 | Kept for frame processors |
| Nitro TFLite | 0.37 MB | 1 | Kept |
| NitroImage | 0 MB | 0 | Removed unused dependency |

## TFLite Assets

| Entry | Size | Notes |
| --- | ---: | --- |
| `res/ag.tflite` | 5.23 MB | MobileFaceNet packaged through React Native `require` |
| `res/vG.tflite` | 0.32 MB | BlazeFace back packaged through React Native `require` |
| `res/iW.tflite` | 0.23 MB | BlazeFace front packaged through React Native `require` |

## Removed From APK

- x86, x86_64, and armeabi-v7a native library payloads.
- Duplicate direct Android asset copies of the three TFLite models.
- MLKit/Barhopper code-scanner native libraries.
- TFLite GPU JNI in release.
- Unused NitroImage native libraries.
- Unused direct dependencies: `@react-native/new-app-screen`, `react-native-nitro-image`, `react-native-permissions`, redundant direct `react-native-screens`.

## Remaining Size Drivers

- React Native native runtime: 6.76 MB for `libreactnative.so`.
- MobileFaceNet model: 5.23 MB.
- TensorFlow Lite CPU JNI: 4.32 MB.
- Hermes VM: 2.46 MB.

Reaching below 20 MB likely requires model quantization/cloud delivery, a smaller recognition model, or a more radical native architecture change. Those affect accuracy, offline behavior, or implementation risk and were not applied blindly.
