# Runtime Validation

Date: 2026-05-28

## Completed Locally

| Validation | Result |
| --- | --- |
| TypeScript compile | Passed |
| Jest tests | Passed |
| Release APK build | Passed |
| Release AAB build | Passed |
| Release APK size analysis | Completed |
| TFLite model packaging check | Completed: one packaged copy of each model remains |
| GPU JNI release exclusion check | Completed: absent from release APK |
| Barhopper/code-scanner native check | Completed: absent from release APK |

## Requires Physical Device

| Validation | Status |
| --- | --- |
| App launch from release APK | Not run locally |
| Camera preview | Requires device |
| Frame processor execution | Requires device |
| Face detection FPS | Requires device |
| Detection latency | Requires device |
| Embedding latency | Requires device |
| Authentication latency | Requires device |
| Liveness detection | Requires device |
| Anti-spoofing rejection | Requires device |
| SQLCipher open/migration on installed app | Requires device |
| Offline sync queue | Requires device/app scenario |
| PostgreSQL sync | Requires configured backend/network |
| 10-15 minute thermal/RAM/FPS stability session | Requires device |

## Suggested Device Commands

```powershell
adb install -r android/app/build/outputs/apk/release/app-arm64-v8a-release.apk
adb logcat | findstr /i "ModelLoader Delegate Benchmark QA-Perf TFLite Camera Database SyncManager"
adb shell dumpsys meminfo com.secureedgemobile
adb shell top -b -n 1 | findstr secureedgemobile
```

## Runtime Risk Notes

- Release now uses NNAPI then CPU and does not package the GPU delegate. If target devices show unacceptable FPS or latency, restore release GPU packaging or make it a product/device-tier build option.
- Code scanner native libraries were removed because barcode scanning is unused. Camera preview and frame processors are separate and remain enabled.
- SQLCipher was intentionally kept to preserve security integrity.
