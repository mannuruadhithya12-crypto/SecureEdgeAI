# Benchmark Results — SecureEdgeMobile APK Size Optimization

**Date:** 2026-05-28

---

## Comparison Table

| Metric | Before (Estimated) | After (Estimated) | Savings |
|--------|-------------------|-------------------|---------|
| **APK Size** (universal) | ~85–100 MB | N/A (splits enabled) | — |
| **APK Size** (arm64-v8a) | ~60–75 MB | **~28–40 MB** | **~45–55%** |
| **AAB Size** (arm64-v8a) | ~45–55 MB | **~20–30 MB** | **~45–55%** |
| **FPS** (face detection) | ~15–25 fps | ~15–25 fps (NNAPI) | No change |
| **Detection Latency** | ~15–35 ms | ~15–35 ms | No change |
| **Embedding Latency** | ~25–50 ms | ~25–50 ms | No change |
| **Auth Latency** | ~80–150 ms | ~80–150 ms | No change |
| **RAM Usage** | ~180–350 MB | ~180–350 MB | No change |
| **CPU Usage** | ~20–60% | ~20–60% | No change |

> **Note:** Performance metrics are expected to remain stable since AI inference speed depends on the delegate (NNAPI performs similarly to GPU on most modern devices). Actual measurements should be taken with `adb shell dumpsys` or integrated telemetry.

---

## Detailed Breakdown

### Size Savings by Optimization

| Optimization | Savings | Cumulative | Notes |
|-------------|---------|------------|-------|
| Baseline (4 ABIs, no min) | 0 MB | ~85–100 MB | Starting point |
| ABI restriction (arm64 only) | ~30–40 MB | ~35–50 MB | Biggest single win |
| Minification + shrinking | ~5–8 MB | ~30–42 MB | ProGuard + resource shrink |
| Remove duplicate models | ~5.6 MB | ~28–40 MB | No longer double-bundled |
| Remove redundant SQLite | ~1.5 MB | ~28–40 MB | SQLCipher is the sole SQL driver |
| Dependency cleanup | ~0.3 MB | ~28–40 MB | Nitro-image, new-app-screen |
| RECORD_AUDIO + code scanner | ~0.1 MB | ~28–40 MB | Manifest + native module |
| **INT8 quantization (future)** | **~3.5 MB** | **~25–36 MB** | Requires TF on Python 3.10–3.12 |

---

## APK Size Breakdown After Optimization

| Component | Estimated Size | % of APK |
|-----------|---------------|----------|
| Native libs (.so) — 1 ABI | ~17–22 MB | 55–60% |
| TFLite models | ~5.6 MB | 15–18% |
| JS Bundle (Hermes, minified) | ~3–6 MB | 10–15% |
| Resources (shrunk) | ~0.5–1 MB | 2–3% |
| Java/Kotlin bytecode (minified) | ~3–5 MB | 10–14% |
| Other (META-INF, signing) | ~0.5–1 MB | 2–3% |
| **Total** | **~28–40 MB** | **100%** |

---

## Acceptance Criteria Status

| Criteria | Status | Notes |
|----------|--------|-------|
| `npx tsc --noEmit` passes | ⏳ Run to verify | Type changes made |
| `npm test` passes | ⏳ Run to verify | Jest tests should pass |
| Release build succeeds | ⏳ Requires `./gradlew assembleRelease` | Build config changed |
| App launches | ⏳ Requires device test | |
| AI inference works | ⏳ Requires device test | Delegate fallback changed |
| Sync works | ⏳ Requires device test | SQLCipher unchanged |
| No crashes | ⏳ Requires device test | |

---

## Verification Steps

```bash
# 1. TypeScript check
npx tsc --noEmit

# 2. Run tests
npm test

# 3. Build release APK
cd android
./gradlew assembleRelease

# 4. Check APK size
Get-ChildItem -Path "app/build/outputs/apk/release/*.apk" | Select-Object Name, Length

# 5. Install on device
adb install app/build/outputs/apk/release/app-arm64-v8a-release.apk

# 6. Run for 5+ minutes and verify:
#    - Camera preview works
#    - Face detection runs
#    - Authentication works
#    - Liveness detection works
#    - No crashes
```

---

## Final Recommendations

### To reach < 20 MB target:
1. **INT8 quantization** (`scripts/quantize_models.py`) — saves ~3.5 MB
2. **Build flavor system** — create `liteRelease` without SQLCipher for non-security-sensitive deployments (saves ~4-5 MB)
3. **Preload models as cached download** on first launch (saves ~5.6 MB)
4. **Use AAB delivery** — Play Store serves only the arm64-v8a AAB, saving additional ~30% through dynamic delivery

### Current best achievable (without sacrificing security/offline):
- **~28–40 MB APK** (arm64-v8a, minified)
- **~20–30 MB AAB** (Play Store compressed)
- **~25–36 MB APK** (with INT8 quantization)
