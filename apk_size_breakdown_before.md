# APK Size Breakdown Before Optimization

Date: 2026-05-28
Artifact: `android/app/build/outputs/apk/release/app-release.apk`
APK size: 147.31 MB
AAB size: 108.56 MB

## Top-Level APK Groups

| Group | Size | Count |
| --- | ---: | ---: |
| `lib` | 120.79 MB | 100 |
| `classes.dex` | 9.12 MB | 1 |
| `classes2.dex` | 8.79 MB | 1 |
| `assets` | 8.27 MB | 9 |
| `classes3.dex` | 7.42 MB | 1 |
| `res` | 6.55 MB | 963 |
| `resources.arsc` | 1.44 MB | 1 |

## ABI Distribution

| ABI | Native Size | Native Libraries |
| --- | ---: | ---: |
| x86 | 35.67 MB | 25 |
| x86_64 | 34.03 MB | 25 |
| arm64-v8a | 30.49 MB | 25 |
| armeabi-v7a | 20.60 MB | 25 |

## Largest Native Libraries

| Entry | Size |
| --- | ---: |
| `lib/x86/libreactnative.so` | 7.12 MB |
| `lib/x86_64/libreactnative.so` | 6.87 MB |
| `lib/x86/libtensorflowlite_jni.so` | 6.80 MB |
| `lib/arm64-v8a/libreactnative.so` | 6.76 MB |
| `lib/x86/libbarhopper_v3.so` | 6.12 MB |
| `lib/x86_64/libtensorflowlite_jni.so` | 6.05 MB |
| `lib/x86_64/libbarhopper_v3.so` | 5.91 MB |
| `lib/arm64-v8a/libbarhopper_v3.so` | 4.95 MB |
| `lib/armeabi-v7a/libreactnative.so` | 4.71 MB |
| `lib/arm64-v8a/libtensorflowlite_jni.so` | 4.32 MB |

## Major Library Contributions

| Component | Size | Count | Notes |
| --- | ---: | ---: | --- |
| TensorFlow Lite JNI total | 28.27 MB | 8 | Includes CPU and GPU JNI across 4 ABIs |
| TensorFlow Lite GPU JNI | 9.16 MB | 4 | High-risk removal; benchmark before excluding |
| MLKit/Barhopper code scanner | 19.29 MB | 4 | Likely from VisionCamera code scanner; app code has no scanner references |
| React Native native runtime | 24.28 MB | 4 | ABI split will reduce this heavily |
| Hermes | 9.74 MB | 8 | Keep enabled; replacing with JSC is unlikely to help |
| VisionCamera native libs | 3.40 MB | 8 | Keep preview/frame processors |
| Worklets | 1.73 MB | 4 | Required by VisionCamera frame processors |
| Nitro TFLite | 1.33 MB | 4 | Required by `react-native-fast-tflite` |
| SQLCipher/SQLite/OpenSSL native match | 0 MB | 0 | No obvious `.so` entries matched these names in the APK; SQLCipher still appears active in JS/TS code |

## TFLite Assets

| Entry | Size | Notes |
| --- | ---: | --- |
| `assets/mobilefacenet.tflite` | 5.23 MB | Duplicate local model copy |
| `res/ag.tflite` | 5.23 MB | React Native packaged `require` model |
| `assets/blazeface_back.tflite` | 0.32 MB | Duplicate local model copy |
| `res/vG.tflite` | 0.32 MB | React Native packaged `require` model |
| `assets/blazeface_front.tflite` | 0.23 MB | Duplicate local model copy |
| `res/iW.tflite` | 0.23 MB | React Native packaged `require` model |
| MLKit barcode model assets | 0.88 MB | From code-scanner stack |

## Duplicate Resource Findings

- The same three app TFLite models exist in `src/assets/models`, `ai-models`, and `android/app/src/main/assets`.
- The release APK contains both React Native resource-packaged TFLite files and direct Android asset TFLite files.
- Keeping both copies costs about 5.78 MB in the APK.

## Initial Optimization Priority

1. Restrict release ABI to `arm64-v8a`.
2. Enable R8/resource shrinking.
3. Remove duplicate `android/app/src/main/assets/*.tflite` copies while keeping `src/assets/models`.
4. Disable VisionCamera code scanner if release build confirms barcode/barhopper removal and camera frame processors remain available.
5. Consider release GPU delegate exclusion only after runtime validation.
