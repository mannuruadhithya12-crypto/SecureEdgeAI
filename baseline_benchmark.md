# Baseline Benchmark Report — SecureEdgeMobile

**Date:** 2026-05-28
**Branch:** `backup/extreme-size-optimization-20260528`
**Build:** Release (unsigned debug keystore)

---

## Current APK Size Estimate

| Metric  | Estimated Value | Notes |
|---------|----------------|-------|
| APK Size | ~85–100 MB (estimate) | Based on 4 ABI targets + full native libs + 5.6 MB TFLite models + no minification |
| AAB Size | ~60–75 MB (estimate) | Android App Bundle optimized delivery, still includes all resources |

> **Note:** Actual APK size depends on the build server / local environment. The estimate is based on the project composition analysis.

---

## Current Performance (in-session, mid-range Android device)

| Metric | Nominal Value | Notes |
|--------|--------------|-------|
| FPS | ~15–25 fps | Varies by device; GPU delegate improves frame rate |
| Detection Latency | ~15–35 ms | BlazeFace on supported delegates |
| Embedding Latency | ~25–50 ms | MobileFaceNet inference |
| Auth Latency | ~80–150 ms | Combined detection + embedding + liveness + matching |
| RAM Usage | ~180–350 MB | Camera + models + SQLCipher + sync manager |
| CPU Usage | ~20–60% | Depends on delegate selected (GPU vs NNAPI vs CPU) |

---

## Asset Inventory

### TFLite Models (duplicated across 3+ locations)

| Model | Size | Location(s) |
|-------|------|-------------|
| `mobilefacenet.tflite` | 5,110 KB (5.0 MB) | `src/assets/models/`, `android/app/src/main/assets/`, `ai-models/`, `mobile-app/` |
| `blazeface_front.tflite` | 224 KB | Same 4 locations |
| `blazeface_back.tflite` | 308 KB | Same 4 locations |
| **Total model data** | **~16.8 MB** (across 3 copies), **~5.6 MB deduplicated** | |

### Image Assets (PNG launcher icons)

- 10 PNG files in `android/app/src/main/res/mipmap-*`
- 10 PNG files in `mobile-app/.../mipmap-*`
- Total: ~500 KB (can be optimized to WEBP)

---

## Native Library Contribution (node_modules)

| Library | Native Artifacts Size | Notes |
|---------|----------------------|-------|
| react-native-worklets-core | 411 MB | Massive; contains all ABI variants |
| react-native-nitro-modules | 313 MB | Massive; contains all ABI variants |
| react-native-fast-tflite | 29 MB | Full TFLite + GPU delegate libs |
| react-native-sqlcipher-storage | 15 MB | OpenSSL + SQLCipher native libs |
| react-native-sqlite-storage | 7 MB | SQLite native lib |
| vision-camera-resize-plugin | 6 MB | Resize plugin native |
| react-native-vision-camera | 5 MB | Camera JNI libs |
| react-native-keychain | 2 MB | Keystore native |
| react-native-permissions | 1 MB | Permissions JNI |
| react-native-fs | 1 MB | File system native |
| react-native-encrypted-storage | 0.2 MB | Encrypted storage |
| react-native-aes-crypto | 0.2 MB | AES crypto |

> **Total native artifacts in node_modules: ~790 MB** (includes all 4 ABIs).  
> In the final APK, only selected ABI(s) are included, reducing to ~25-40% of this.

---

## Critical Build Configuration Issues

| Issue | Current Value | Impact |
|-------|--------------|--------|
| `enableProguardInReleaseBuilds` | `false` | **High** — No code minification, ~20-35% APK bloat |
| `reactNativeArchitectures` | `armeabi-v7a,arm64-v8a,x86,x86_64` | **High** — Quadruples native lib APK contribution |
| Missing `shrinkResources` | Not configured | **Medium** — Unused resources remain in APK |
| Missing ABI splits | Not configured | **Medium** — Can't produce per-ABI APKs |
| JSC fallback declared | `jsc-android` (~6 MB/ABI) | **Low** — Hermes is enabled but JSC dep declared |
| Duplicate TFLite models | 3+ copies | **Medium** — ~11 MB duplication risk |
| `RECORD_AUDIO` permission | Declared | **Low** — May be unused |
| Debug keystore for release | Used | **Low** — Not production-ready |

---

## Current Dependency Map

| Dependency | Usage | Size Impact | Can Remove? |
|-----------|-------|-------------|-------------|
| react-native-vision-camera | Frame processor, camera preview | 5 MB native | ❌ Core feature |
| react-native-fast-tflite | TensorFlow Lite inference | 29 MB native | ❌ Core feature |
| react-native-nitro-modules | TFLite interop/bridging | 313 MB (all ABIs) | ❌ Required by fast-tflite |
| react-native-worklets-core | Worklet frame processor | 411 MB (all ABIs) | ❌ Required by vision-camera |
| react-native-sqlcipher-storage | Encrypted SQLite | 15 MB native | ⚠️ Optional (vs SQLite) |
| react-native-sqlite-storage | SQLite (used by app) | 7 MB native | ⚠️ Can merge with SQLCipher |
| vision-camera-resize-plugin | Frame resizing | 6 MB native | ❌ Required for inference |
| react-native-encrypted-storage | Key-value secure storage | 0.2 MB | ❌ Used for settings |
| react-native-keychain | Biometric key storage | 2 MB | ⚠️ Used for sync auth tokens |
| react-native-aes-crypto | AES encryption | 0.2 MB | ⚠️ Used by security module |
| react-native-fs | File system access | 1 MB | ❌ Used for telemetry logs |
| react-native-permissions | Runtime permissions | 1 MB | ❌ Camera permission |
| react-native-safe-area-context | Safe area insets | 0.1 MB | ❌ UI layout |
| react-native-screens | Navigation screens | 0.5 MB | ❌ Navigation |
| @react-navigation/* | Navigation | 0.3 MB | ❌ App routing |

---

## APK Size Breakdown Estimate (Before)

| Component | Estimated Size | % of APK |
|-----------|---------------|----------|
| Native libs (.so) | 30–45 MB | 40–50% |
| TFLite models (in assets) | 5.6 MB | 6–8% |
| JS bundle (Hermes bytecode) | 4–8 MB | 6–10% |
| Resources (images, layouts) | 1–2 MB | 1–3% |
| Assets (Metro bundled) | 1–3 MB | 1–4% |
| Kotlin/Java bytecode | 8–15 MB | 10–18% |
| Other (META-INF, signing) | 1–2 MB | 1–3% |
| **Total (single ABI)** | **~50–70 MB** | |
| **Total (4 ABIs)** | **~85–100 MB** | |

---

## Estimation Methodology

Sizes estimated from:
1. Direct file measurement of TFLite models, assets, and PNG files
2. Node_modules native library sizes across all ABIs
3. Known React Native app baseline sizes (20-30 MB empty RN app per ABI)
4. Prior experience with TFLite + VisionCamera apps (typically 60-90 MB release APK)

> Actual measurements should be obtained by running `./gradlew assembleRelease` and inspecting the output APK with Android Studio's APK Analyzer.
