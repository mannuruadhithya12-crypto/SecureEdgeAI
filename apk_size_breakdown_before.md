# APK Size Breakdown — Before Optimization

**Date:** 2026-05-28
**Branch:** `backup/extreme-size-optimization-20260528`

---

## 1. Native Libraries (.so files)

### Largest Contributors (across all 4 ABIs)

| Library | .so File(s) | Size per ABI | Notes |
|---------|-------------|-------------|-------|
| `react-native-fast-tflite` | `libtensorflowlite_*.so`, `libtensorflowlite_gpu_jni.so` | ~6-8 MB | Full TFLite runtime + GPU delegate |
| `react-native-sqlcipher-storage` | `libsqlcipher.so`, `libcrypto.so`, `libssl.so` | ~4-5 MB | OpenSSL 3.x + SQLCipher |
| `react-native-vision-camera` | `libVisionCamera*.so` | ~1.5 MB | Camera JNI bridge |
| `react-native-worklets-core` | `libRNWorklets*.so` | ~1 MB | Worklet engine |
| `react-native-nitro-modules` | `libNitroModules*.so` | ~1 MB | NITRO bridge |
| `react-native-sqlite-storage` | `libsqlite3.so` | ~1.5 MB | Stock SQLite |
| `vision-camera-resize-plugin` | `libVisionCameraResizePlugin*.so` | ~1 MB | Frame resize |
| `react-native-fs` | `librnfs.so` | ~0.3 MB | File system |
| `react-native-keychain` | `libRNKeychain.so` | ~0.5 MB | Keychain |
| Other | misc | ~1 MB | Permissions, crypto, etc. |

**Total .so per ABI: ~17-22 MB**
**Total .so across 4 ABIs: ~68-88 MB**

> Currently `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` — all 4 ABIs included.

### GPU Delegate Impact

The `libtensorflowlite_gpu_jni.so` (TFLite GPU delegate) adds ~2-3 MB per ABI.
Total GPU delegate waste: ~8-12 MB across all 4 ABIs (or ~2-3 MB if arm64-only).

---

## 2. TFLite Models

| Model | Size | In APK? |
|-------|------|---------|
| `mobilefacenet.tflite` | 5,110 KB (5.0 MB) | ✅ Via Metro assets (`src/assets/models/`) + ✅ Manual copy (`android/app/src/main/assets/`) |
| `blazeface_front.tflite` | 224 KB | ✅ Same duplication |
| `blazeface_back.tflite` | 308 KB | ✅ Same duplication |

**Duplication issue:** Models are included both via Metro bundler (from `require('./src/assets/models/...')`) AND manually placed in `android/app/src/main/assets/`. If both paths end up in the APK, there is ~5.6 MB of redundant data.

---

## 3. JS Bundle (Hermes Bytecode)

- Hermes enabled → `.hbc` bundle
- Estimated size: **4-8 MB** (depends on code size)
- Minification disabled → bundle not compressed

---

## 4. Resources

| Resource | Size | Notes |
|----------|------|-------|
| Mipmap PNGs (6 densities × 2 icons) | ~500 KB | Can be WEBP or adaptive icon |
| Android layouts (XML) | ~10 KB | Minimal |
| Other resources | ~50 KB | Colors, strings, etc. |

---

## 5. Duplicate Project (`mobile-app/`)

The `mobile-app/SecureEdgeMobile/` directory is a **complete duplicate** of the project with its own `node_modules/` (187 MB). This does NOT affect APK size directly but indicates a need to clean up the repository structure (1160 MB of wasted space).

---

## 6. Estimated Breakdown Summary

### Current Configuration (4 ABIs, no minification)

| Layer | Size |
|-------|------|
| Native .so (4 ABIs) | ~68-88 MB |
| TFLite models | ~5.6 MB |
| JS Bundle | ~4-8 MB |
| Resources | ~0.5 MB |
| Java bytecode | ~8-15 MB |
| Other | ~2 MB |
| **Estimated APK Total** | **~85-100 MB** |

### If Restricted to arm64-v8a Only

| Layer | Size |
|-------|------|
| Native .so (1 ABI) | ~17-22 MB |
| TFLite models | ~5.6 MB |
| JS Bundle | ~4-8 MB |
| Resources | ~0.5 MB |
| Java bytecode | ~8-15 MB |
| Other | ~2 MB |
| **Estimated APK Total** | **~35-50 MB** |

> **Key insight:** Simply restricting to arm64-v8a alone saves ~40-50 MB.
> Adding minification, shrinking, and model optimization can bring this to <30 MB.
> The <20 MB target requires additional aggressive measures (model quantization, dependency pruning, optional features removal).
