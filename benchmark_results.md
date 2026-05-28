# Benchmark Results

Date: 2026-05-28

## Size Comparison

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| APK Size | 147.31 MB | 30.17 MB | -117.14 MB |
| AAB Size | 108.56 MB | 37.75 MB | -70.81 MB |
| Native ABI Count | 4 | 1 | -3 |
| Native Library Payload | 120.79 MB | 19.85 MB | -100.94 MB |
| TFLite GPU JNI | 9.16 MB across 4 ABIs | 0 MB in release | Removed |
| MLKit/Barhopper | 19.29 MB | 0 MB | Removed |
| Duplicate Android asset models | 5.78 MB | 0 MB | Removed |

## Runtime Metrics

| Metric | Before | After |
| --- | --- | --- |
| FPS | Not measured locally | Requires physical device |
| Detection Latency | Not measured locally | Requires physical device |
| Embedding Latency | Not measured locally | Requires physical device |
| Auth Latency | Not measured locally | Requires physical device |
| RAM Usage | Not measured locally | Requires physical device/profiler |
| CPU Usage | Not measured locally | Requires physical device/profiler |

## Local Validation

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed |
| `npm test -- --runInBand` | Passed: 6 suites, 20 tests |
| `.\gradlew.bat :app:assembleRelease :app:bundleRelease --no-daemon --console=plain --stacktrace` | Passed |
| Release APK generated | `android/app/build/outputs/apk/release/app-arm64-v8a-release.apk` |
| Release AAB generated | `android/app/build/outputs/bundle/release/app-release.aab` |
| `npx depcheck` | Runtime dependencies cleaned; remaining findings are dev-tooling packages retained intentionally |

## Target Status

| Priority | Goal | Status |
| --- | ---: | --- |
| Ideal | <20 MB | Not reached |
| Excellent | 20-30 MB | Missed by about 0.17 MB APK |
| Acceptable | 30-40 MB | Reached |

The APK is just above the excellent band at 30.17 MB. Further reduction below 30 MB is likely possible with model quantization or deeper dependency/runtime changes, but those need accuracy and device validation.
