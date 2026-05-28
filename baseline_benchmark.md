# Baseline Benchmark Snapshot

Date: 2026-05-28
Baseline commit: `b2f6812`
Build commands:

```powershell
cd C:\RN\SecureEdgeMobile\android
.\gradlew.bat :app:assembleRelease --no-daemon --console=plain --stacktrace
.\gradlew.bat :app:bundleRelease --no-daemon --console=plain --stacktrace
```

## Artifact Metrics

| Metric | Current |
| --- | ---: |
| APK Size | 147.31 MB |
| AAB Size | 108.56 MB |
| APK Path | `android/app/build/outputs/apk/release/app-release.apk` |
| AAB Path | `android/app/build/outputs/bundle/release/app-release.aab` |

## Runtime Metrics

| Metric | Current |
| --- | --- |
| FPS | Not measured locally; requires physical device camera run |
| Detection Latency | Not measured locally; requires instrumented device run |
| Embedding Latency | Not measured locally; requires instrumented device run |
| Auth Latency | Not measured locally; requires instrumented device run |
| RAM Usage | Not measured locally; requires Android profiler/adb collection |
| CPU Usage | Not measured locally; requires Android profiler/adb collection |

## Local Build Notes

- The first `clean assembleRelease bundleRelease` invocation exceeded a 10-minute timeout and left no artifacts.
- Separate `:app:assembleRelease` and `:app:bundleRelease` commands completed successfully.
- Build emitted deprecation warnings from native dependencies and a React Native config warning for `react-native-sqlite-storage`, but release artifact generation succeeded.

## Required Device Benchmark Procedure

1. Install the release APK on a representative arm64 Android device.
2. Run registration and authentication flows with live face input.
3. Capture FPS from existing app FPS logging and/or `adb logcat`.
4. Capture latency logs for detection, embedding, and auth.
5. Record RAM/CPU using Android Studio profiler or:

```powershell
adb shell dumpsys meminfo com.secureedgemobile
adb shell top -b -n 1 | findstr secureedgemobile
```

6. Run a 10-15 minute camera/auth session and record thermal/FPS stability.
