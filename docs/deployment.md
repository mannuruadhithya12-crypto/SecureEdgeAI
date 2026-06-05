# Deployment — SecureEdgeMobile

## Build Variants

| Variant | Use Case | Security Checks | Emulator Mode |
|---|---|---|---|
| Debug (`assembleDebug`) | Development | Bypassed (`__DEV__=true`) | Enabled |
| Release (`assembleRelease`) | Production | Active | Disabled |

---

## Release Build

### Prerequisites

1. Android Studio + SDK API 35 installed
2. Java 17 JDK on PATH
3. Android NDK installed (for CMake/Nitro modules)
4. `local.properties` in `android/` with `sdk.dir` set

### Build Command

```bash
cd android
./gradlew assembleRelease
```

**Output:**
```
android/app/build/outputs/apk/release/app-arm64-v8a-release.apk
```

### Verify APK

```bash
# Check size (must be < 19 MB)
Get-Item "android/app/build/outputs/apk/release/app-arm64-v8a-release.apk" |
  Select-Object @{N='Size_MB';E={[math]::Round($_.Length/1MB,2)}}

# Check ABI (must only contain arm64-v8a)
# Extract and inspect lib/ directory
```

---

## Device Deployment

```bash
# Install on connected device
adb install android/app/build/outputs/apk/release/app-arm64-v8a-release.apk

# Verify installation
adb shell pm list packages | findstr secureedgemobile

# Launch app
adb shell am start -n com.secureedgemobile/.MainActivity
```

### Fresh Install (wipe previous data)

```bash
adb uninstall com.secureedgemobile
adb install android/app/build/outputs/apk/release/app-arm64-v8a-release.apk
```

---

## Signing

The release APK must be signed with a production keystore.
Keep the keystore file and passwords **outside** the repository.

```bash
# Generate keystore (one time)
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore secureedge-release.keystore \
  -alias secureedge \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Configure in android/gradle.properties (not committed to git)
MYAPP_UPLOAD_STORE_FILE=secureedge-release.keystore
MYAPP_UPLOAD_KEY_ALIAS=secureedge
MYAPP_UPLOAD_STORE_PASSWORD=***
MYAPP_UPLOAD_KEY_PASSWORD=***
```

---

## CI/CD

GitHub Actions workflow: `.github/workflows/ci.yml`

Runs on every push and pull request:
1. `npm install`
2. `npx tsc --noEmit` (type check)
3. `npm test` (unit tests)
4. Android build validation

See `.github/workflows/ci.yml` for full configuration.

---

## Environment Variables

No environment variables are required for the app itself — everything is stored
in EncryptedStorage or Android Keystore on the device.

For the optional AWS sync backend:

```
AWS_REGION=ap-south-1
AWS_ATTENDANCE_ENDPOINT=https://api.secureedge.ai/attendance
```

These are configured in `src/api/attendanceApi.ts` and should be set at build time
via build config or environment injection.

---

## Supported Devices

| Requirement | Minimum | Recommended |
|---|---|---|
| Android version | 8.0 (API 26) | 10.0+ (API 29+) |
| Architecture | arm64-v8a | arm64-v8a |
| RAM | 2 GB | 4 GB+ |
| Camera | Front-facing | 720p+ front |
| Storage | 50 MB free | 100 MB free |
| Hardware Keystore | Optional | Required for production |

---

## Post-Deployment Verification

After installing on a production device, run through the full QA checklist:

1. ✅ Registration completes (score ≥ 80)
2. ✅ Password login succeeds
3. ✅ Face login activates correct user
4. ✅ Attendance record created
5. ✅ Attendance screen shows records
6. ✅ Face re-registration returns to Dashboard
7. ✅ Security Dashboard shows all green (on clean device)
8. ✅ APK size < 19 MB

See `docs/testing.md` for full test case matrix and adb commands.
