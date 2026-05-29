# Optimization Report — SecureEdgeMobile Extreme APK Size Optimization

**Date:** 2026-05-28
**Target:** < 20 MB production APK/AAB

---

## Executive Summary

A comprehensive optimization pass was applied to the SecureEdgeMobile Android app. The primary changes target APK bloat caused by:
- Disabled minification (`minifyEnabled = false`)
- All 4 CPU architectures bundled (armeabi-v7a, arm64-v8a, x86, x86_64)
- No ABI splitting
- No resource shrinking
- Duplicate TFLite model assets
- Redundant native library (`react-native-sqlite-storage`)

---

## Changes Applied

### Phase 1 — Release Build Optimization (HIGHEST IMPACT)

| Change | File | Detail |
|--------|------|--------|
| Enable minification | `android/app/build.gradle` | `minifyEnabled true`, `shrinkResources true` |
| ProGuard optimization | `android/app/build.gradle` | `proguard-android-optimize.txt` instead of `proguard-android.txt` |
| ABI restriction | `android/app/build.gradle` + `gradle.properties` | `arm64-v8a` only (was 4 ABIs) |
| ABI splits | `android/app/build.gradle` | Per-ABI APK split, no universal APK |
| Debug symbols | `android/app/build.gradle` | `debugSymbolLevel 'NONE'` in release |
| Resource exclusions | `android/app/build.gradle` | `META-INF/*`, `*.kotlin_module` excluded |
| ProGuard rules | `android/app/proguard-rules.pro` | Added comprehensive keep rules for TFLite, VisionCamera, SQLCipher, etc. |

**Estimated savings:** ~40–55 MB (from 4 ABIs → 1 ABI + code shrinking)

### Phase 2 — GPU Delegate Strategy (MEDIUM IMPACT)

| Change | File | Detail |
|--------|------|--------|
| Conditional GPU delegate | `App.tsx` | `ENABLE_GPU_DELEGATE = __DEV__` — GPU used only in debug builds |
| Release fallback | `App.tsx` | Release uses NNAPI → CPU (skips GPU) |
| GPU libs | — | GPU libs still ship in APK (~2 MB) but are not loaded in release |

**Rationale:** GPU delegate adds ~2–3 MB native libs. Skipping GPU in release avoids potential delegate loading overhead. GPU is still available for debug/development.

**Estimated savings:** 0 MB (GPU libs still bundled but unused) — future: exclude GPU AAR

### Phase 3 — VisionCamera Feature Reduction (LOW IMPACT)

| Change | File | Detail |
|--------|------|--------|
| Code scanner disabled | `android/gradle.properties` | `VisionCamera_enableCodeScanner = false` |
| RECORD_AUDIO removed | `AndroidManifest.xml` | Permission removed (no audio needed) |

**Estimated savings:** ~100 KB (code scanner native module + manifest entry)

### Phase 4 — SQLCipher Optimization (SECURITY PRIORITY)

| Change | File | Detail |
|--------|------|--------|
| SQLCipher retained | — | Security-critical encrypted database kept |
| Redundant SQLite removed | `package.json` | `react-native-sqlite-storage` removed |
| Type declaration fixed | `src/types/react-native-sqlcipher-storage.d.ts` | Self-contained types, no longer imports from removed package |

**Rationale:** SQLCipher (15 MB native) provides essential encryption for offline attendance data. Removing it would weaken security and break migration paths. The duplicate `react-native-sqlite-storage` (~7 MB node_modules, ~1.5 MB APK contribution) was safely removed.

**Estimated savings:** ~1.5 MB (SQLite native lib not bundled)

### Phase 5 — Cloud Model Delivery (DEFERRED)

**Not implemented.** Moving models to cloud would break offline functionality which is a core requirement. Models total only ~5.6 MB.

### Phase 6 — TFLite Model Quantization (FUTURE OPTIMIZATION)

| Change | File | Detail |
|--------|------|--------|
| Quantization script | `scripts/quantize_models.py` | Script created for TF Lite INT8 quantization |
| Pipeline documented | See script | Requires Python 3.10–3.12 + tensorflow-cpu |

**Expected savings:** ~3.5 MB (MobileFaceNet 5.0 MB → ~1.5 MB INT8)

**Blocked by:** Python 3.14 environment — TF not yet available. Run with Python 3.10–3.12.

### Phase 7 — Dependency Cleanup (MEDIUM IMPACT)

| Change | File | Detail |
|--------|------|--------|
| `@react-native/new-app-screen` removed | `package.json` | Scaffolding package, never used |
| `react-native-nitro-image` removed | `package.json` | Not found in node_modules, not imported |
| `react-native-sqlite-storage` removed | `package.json` | Redundant (SQLCipher used instead) |
| Duplicate TFLite models removed | `android/app/src/main/assets/` | Models already bundled via Metro from `src/assets/models/` |

---

## File Changes Summary

| File | Status |
|------|--------|
| `android/app/build.gradle` | MODIFIED |
| `android/gradle.properties` | MODIFIED |
| `android/app/proguard-rules.pro` | MODIFIED |
| `android/app/src/main/AndroidManifest.xml` | MODIFIED |
| `App.tsx` | MODIFIED |
| `package.json` | MODIFIED |
| `src/types/react-native-sqlcipher-storage.d.ts` | MODIFIED |
| `scripts/quantize_models.py` | NEW |
| `android/app/src/main/assets/*.tflite` | DELETED (3 files) |
| `baseline_benchmark.md` | NEW |
| `apk_size_breakdown_before.md` | NEW |

---

## Estimated APK Size Projection

| Configuration | Estimated Size |
|--------------|---------------|
| **Before** (4 ABIs, no minification) | ~85–100 MB |
| After arm64-v8a only | ~35–50 MB |
| + Minification + shrinking | ~30–42 MB |
| + Dup model removal + SQLite removal | ~28–40 MB |
| + INT8 quantization (future) | ~25–35 MB |
| **After all optimizations** | **~28–40 MB** |
| **Target (< 20 MB)** | **Not yet met — see recommendations** |

---

## Remaining Optimizations to Reach < 20 MB

To reach the < 20 MB target, additional aggressive measures are needed:

1. **INT8 model quantization** (~3–4 MB savings) — run `scripts/quantize_models.py`
2. **Remove SQLCipher entirely** (~4–5 MB savings) — security tradeoff, creates `liteRelease` flavor
3. **Move models to cloud download** (~5.6 MB savings) — breaks offline use
4. **Strip Hermes debug symbols** (~1–2 MB savings)
5. **Use Android App Bundle (AAB)** — Play Store dynamic delivery reduces download size by ~30%
6. **Replace full TFLite with XNNPACK-only build** (~2–3 MB savings)
7. **Remove unused VisionCamera CameraX dependencies** (~1–2 MB)

---

## Tradeoff Documentation

### Recommended for Production Stability

| Optimization | Risk | Verdict |
|-------------|------|---------|
| Remove GPU delegates | ⚠️ May reduce FPS on some devices | Keep for now; CPU/NNAPI fallback works |
| Remove SQLCipher | 🔴 Weakens security | KEEP — security is core requirement |
| Cloud model delivery | 🔴 Breaks offline functionality | KEEP — offline sync is essential |
| INT8 quantization | ⚠️ May reduce auth accuracy | TRY — validate with test dataset first |
| Remove VisionCamera features | ⚠️ May break frame processors | Already minimal impact |

---

## How to Build

```bash
# Build release APK (arm64-v8a only, minified)
cd android
./gradlew assembleRelease

# Build release AAB
./gradlew bundleRelease

# Build all ABI-split APKs
./gradlew assembleRelease
# APKs in: android/app/build/outputs/apk/release/
```

Verify APK size with:
```bash
ls -lh android/app/build/outputs/apk/release/*.apk
```
