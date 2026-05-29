# Optimization Walkthrough — SecureEdgeMobile

## Files Changed

### 1. `android/app/build.gradle` — Release Build Optimization

**What changed:**
- `minifyEnabled true` and `shrinkResources true` — enables ProGuard code shrinking and resource removal
- Added `ndk { abiFilters "arm64-v8a" }` — builds only for ARM64 devices
- Added ABI splits — produces separate APKs per architecture (arm64-v8a only)
- `debugSymbolLevel 'NONE'` — strips debug symbols in release builds
- `packagingOptions.resources.excludes` — removes META-INF and kotlin_module files
- Changed to `proguard-android-optimize.txt` for better optimization

**Why:** These are the highest-impact changes. Minification alone saves 15-25%, ABI restriction saves 50%+ by building for only one architecture.

### 2. `android/gradle.properties` — Architecture & Feature Toggles

**What changed:**
- `reactNativeArchitectures=arm64-v8a` — only ARM64 (was all 4 architectures)
- `VisionCamera_enableCodeScanner=false` — disables unused code scanner

**Why:** Reduces native library size by 75% and removes unused camera feature.

### 3. `android/app/proguard-rules.pro` — Keep Rules for Libraries

**What changed:**
- Added comprehensive `-keep` rules for TFLite, VisionCamera, SQLCipher, NitroModules, WorkletsCore, Keychain, etc.
- Added rules for JNI methods and Serializable classes

**Why:** Without these rules, minification would strip classes needed by native libraries at runtime.

### 4. `android/app/src/main/AndroidManifest.xml` — Remove Unused Permission

**What changed:**
- Removed `RECORD_AUDIO` permission

**Why:** The app only does face detection; no audio is recorded.

### 5. `android/app/src/main/assets/` — Remove Duplicate Models (3 files deleted)

**What changed:**
- Deleted `blazeface_front.tflite`, `blazeface_back.tflite`, `mobilefacenet.tflite`

**Why:** These models are already bundled via Metro bundler from `src/assets/models/` through the `require()` calls in App.tsx. Having them in `android/app/src/main/assets/` causes double-bundling (~5.6 MB waste).

### 6. `App.tsx` — Conditional GPU Delegate

**What changed:**
- Added `const ENABLE_GPU_DELEGATE = __DEV__;`
- Modified delegate fallback chain:
  - Debug: GPU → NNAPI → CPU
  - Release: NNAPI → CPU

**Why:** GPU delegate adds ~2-3 MB of native libs and isn't always necessary. Release builds prioritize stability over peak FPS.

### 7. `package.json` — Remove Unused Dependencies

**Removed:**
- `@react-native/new-app-screen` — scaffolding package, not used
- `react-native-nitro-image` — not found in node_modules, not used
- `react-native-sqlite-storage` — redundant (SQLCipher used instead)

**Why:** Reduces install size and avoids native library bloat from unused packages.

### 8. `src/types/react-native-sqlcipher-storage.d.ts` — Self-Contained Types

**What changed:**
- Replaced `import SQLite from 'react-native-sqlite-storage'` with inline type definitions
- Added `SQLError`, `Results`, `Database`, `Transaction`, `DatabaseParams` interfaces

**Why:** Allows removal of `react-native-sqlite-storage` package while maintaining TypeScript compatibility.

---

## Files Created

### 9. `scripts/quantize_models.py` — TFLite INT8 Quantization Script

Script to quantize FP32 TFLite models to INT8 for ~3.5 MB savings.
Requires Python 3.10-3.12 with `tensorflow-cpu==2.13.0`.

### 10. `baseline_benchmark.md` — Pre-Optimization Baseline

### 11. `apk_size_breakdown_before.md` — Pre-Optimization APK Analysis

### 12. `optimization_report.md` — Full Optimization Report

### 13. `benchmark_results.md` — Before/After Comparison

---

## Build & Verify

```bash
cd android
./gradlew assembleRelease
# APK at: app/build/outputs/apk/release/app-arm64-v8a-release.apk

# Check size
ls -lh app/build/outputs/apk/release/*.apk

# Install on device
adb install app/build/outputs/apk/release/app-arm64-v8a-release.apk
```
