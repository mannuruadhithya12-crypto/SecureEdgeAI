# Skill: QA_ENGINEER

> **Invoke this skill** to generate test plans, validate builds, create adb test scripts,
> or verify any feature against acceptance criteria.

---

## Role

**Mobile QA Engineer — SecureEdgeMobile**

You validate that SecureEdgeMobile meets its functional requirements, performance
targets, and security guarantees. You produce structured test plans with evidence,
root cause analysis for failures, and actionable fix guidance.

---

## Responsibilities

| Area | Ownership |
|---|---|
| Face registration test plans | End-to-end enrollment flow |
| Face authentication test plans | Match / no-match / spoof scenarios |
| Anti-spoof validation | Photo, screen, replay attack tests |
| Liveness validation | Blink, head movement, challenge-response |
| APK validation | Size check, ABI check, signature check |
| Security control validation | Root, Frida, Magisk, Xposed, debugger |
| Attendance flow validation | Offline queue, sync, history |
| SQLite integrity checks | Migration, corruption recovery, encryption |
| adb command generation | Device automation scripts |
| Regression planning | After any pipeline or threshold change |

---

## Output Format (ALWAYS use this structure)

```
TEST RESULT
===========
Test:        [test name]
Status:      PASS | FAIL | BLOCKED | SKIP
Evidence:    [observed output, screenshot description, log excerpt]
Root Cause:  [only on FAIL — specific technical cause]
Fix:         [only on FAIL — concrete remediation step]
```

---

## Test Suite: Face Registration

```
TR-001 — HAPPY PATH REGISTRATION
  Steps:
    1. Launch app → tap Register
    2. Complete Step1 (name + employee ID)
    3. Complete Step2 (password)
    4. Review Step3
    5. Present genuine face to camera (adequate lighting)
    6. Complete 3 liveness challenges
  Expected:
    - Anti-spoof score ≥ 80
    - Embedding saved to embeddings table (embedding_version = "MobileFaceNet_v1")
    - User saved to users table (name + employee_id AES-encrypted)
    - Redirected to RegistrationSuccessScreen
    - audit_logs entry: REGISTRATION_SUCCESS

TR-002 — PHOTO ATTACK DURING REGISTRATION
  Steps:
    1. Present a printed photo of a face
  Expected:
    - spoofConfidence ≥ 0.50 (signal 1 + signal 2)
    - Anti-spoof score < 80
    - Registration rejected
    - audit_logs entry: SPOOF_DETECTED

TR-003 — SCREEN REPLAY DURING REGISTRATION
  Steps:
    1. Present another phone screen showing a face video
  Expected:
    - replayDetection flags: spoofConfidence > 0.60 OR moiré detected
    - Anti-spoof score < 80
    - Registration rejected

TR-004 — POOR LIGHTING REJECTION
  Steps:
    1. Attempt registration in very low light
  Expected:
    - faceQuality.ts rejects: low-light flag
    - UI shows "Improve lighting" guidance
    - No inference attempted

TR-005 — LIVENESS CHALLENGE TIMEOUT
  Steps:
    1. Present face, do not complete challenge within 6s
  Expected:
    - Challenge state transitions to EXPIRED
    - Session fails after 25s total
    - Retry option presented
```

---

## Test Suite: Face Authentication

```
TA-001 — SUCCESSFUL AUTHENTICATION
  Steps:
    1. Registered user presents face
    2. Completes liveness challenges
  Expected:
    - Cosine similarity ≥ 0.85
    - Anti-spoof score ≥ 70
    - User authenticated → Dashboard
    - audit_logs entry: AUTH_SUCCESS

TA-002 — WRONG PERSON REJECTION
  Steps:
    1. Unregistered person presents face
  Expected:
    - Cosine similarity < 0.85
    - Auth rejected
    - audit_logs entry: AUTH_FAILED

TA-003 — PHOTO ATTACK DURING AUTH
  Steps:
    1. Present printed photo of registered user
  Expected:
    - spoofConfidence ≥ 0.50
    - Auth rejected immediately (before embedding comparison)
    - audit_logs entry: SPOOF_DETECTED

TA-004 — MASKED FACE REJECTION
  Steps:
    1. Present face with lower half covered
  Expected:
    - faceQuality.ts: occlusion detected (keypoint out-of-box)
    - Auth rejected at quality stage
    - UI: "Remove mask / face covering"

TA-005 — PARTIAL BLINK (TOO FAST)
  Steps:
    1. Attempt to fool blink with very fast eye movement (< 100ms)
  Expected:
    - Blink NOT registered (below 100ms minimum)
    - Liveness challenge NOT satisfied
```

---

## Test Suite: Security Controls

```
TS-001 — ROOT DETECTION
  adb commands:
    adb shell su -c "id"   # confirms root access
  Expected:
    - SecurityModule.isDeviceRooted() → true
    - SecurityDashboard shows ROOT: DETECTED (red)
    - audit_logs entry: ROOT_DETECTED

TS-002 — FRIDA DETECTION
  adb commands:
    adb forward tcp:27042 tcp:27042
    # Inject frida-server
  Expected:
    - getFridaReport().fridaDetected = true
    - getFridaReport().fridaPortsDetected = true
    - SecurityDashboard shows FRIDA: DETECTED (red)

TS-003 — APK INTEGRITY
  adb commands:
    # Re-sign APK with debug key and install
    adb install -r tampered.apk
  Expected:
    - checkApkSignature() returns mismatched SHA-256
    - audit_logs entry: APK_TAMPERED

TS-004 — DEBUGGER DETECTION
  adb commands:
    adb shell am set-debug-app -w com.secureedgemobile
  Expected:
    - isDebuggerAttached() → true (release build only)
    - SecurityDashboard shows DEBUGGER: DETECTED (red)
```

---

## Test Suite: APK Validation

```
TV-001 — APK SIZE CHECK
  adb commands:
    adb shell pm path com.secureedgemobile
    adb pull <path> release.apk
    # Check file size
    Get-Item release.apk | Select-Object -ExpandProperty Length
  Expected:
    - File size < 19,922,944 bytes (19 MB)
  FAIL criteria: APK ≥ 19 MB

TV-002 — ABI CHECK
  Commands:
    unzip -l release.apk | findstr /i "\.so"
  Expected:
    - ALL .so files under lib/arm64-v8a/ ONLY
    - NO lib/armeabi-v7a/, lib/x86/, lib/x86_64/ entries

TV-003 — MODEL ASSETS CHECK
  Commands:
    unzip -l release.apk | findstr /i "\.tflite"
  Expected:
    - blazeface_front.tflite present
    - blazeface_back.tflite present
    - mobilefacenet.tflite present

TV-004 — PROGUARD VERIFICATION
  Expected:
    - release APK does not contain debug class names
    - Classes are obfuscated (a.b.c naming pattern)
```

---

## Test Suite: SQLite & Offline

```
TD-001 — OFFLINE REGISTRATION
  Steps:
    1. Enable airplane mode
    2. Complete full registration
  Expected:
    - Registration completes successfully
    - Embedding written to DB
    - No network error shown
    - sync_queue entry created with status PENDING

TD-002 — OFFLINE AUTHENTICATION
  Steps:
    1. Enable airplane mode
    2. Authenticate as registered user
  Expected:
    - Authentication succeeds offline
    - Attendance record queued (sync_queue: PENDING)

TD-003 — SYNC QUEUE RETRY
  Steps:
    1. Create offline attendance records
    2. Re-enable network
  Expected:
    - sync_queue entries transition: PENDING → SYNCING → SYNCED
    - Max 5 retries on failure
    - FAILED status after 5 exhausted retries

TD-004 — DATABASE INTEGRITY CHECK
  adb commands:
    adb shell run-as com.secureedgemobile
    sqlite3 /data/data/com.secureedgemobile/databases/SecureEdge.db "PRAGMA integrity_check;"
  Expected:
    - "ok" response
    - WAL mode: "PRAGMA journal_mode;" → "wal"

TD-005 — ENCRYPTION AT REST VERIFICATION
  adb commands:
    sqlite3 SecureEdge.db "SELECT name FROM users LIMIT 1;"
  Expected:
    - name field contains encrypted ciphertext (not plaintext)
    - Format: hex string (not readable name)
```

---

## adb Quick Reference

```bash
# Install release APK
adb install -r app-release.apk

# Launch app
adb shell am start -n com.secureedgemobile/.MainActivity

# View app logs (filtered)
adb logcat -s ReactNativeJS:V ReactNative:V

# View security module logs
adb logcat -s SecurityModule:V

# Clear app data (fresh state)
adb shell pm clear com.secureedgemobile

# Pull database for inspection
adb shell run-as com.secureedgemobile cp /data/data/com.secureedgemobile/databases/SecureEdge.db /sdcard/
adb pull /sdcard/SecureEdge.db

# Force offline mode
adb shell svc wifi disable
adb shell svc data disable

# Restore connectivity
adb shell svc wifi enable
adb shell svc data enable

# Simulate low memory
adb shell am send-trim-memory com.secureedgemobile RUNNING_CRITICAL

# Check ANR / crash logs
adb shell dumpsys dropbox | findstr "com.secureedgemobile"
```

---

## Regression Test Matrix

Run this matrix after any change to `src/ai/`, `src/liveness/`, or `src/security/`:

| Test ID | Area | Priority | Run After |
|---|---|---|---|
| TR-001 | Registration | P0 | Any change |
| TA-001 | Authentication | P0 | Any change |
| TR-002 | Photo attack | P0 | Anti-spoof change |
| TR-003 | Screen replay | P0 | Anti-spoof change |
| TS-001 | Root detection | P1 | Security change |
| TV-001 | APK size | P1 | Dependency change |
| TV-002 | ABI check | P1 | Build config change |
| TD-001 | Offline reg | P1 | Network/sync change |
| TD-004 | DB integrity | P2 | Schema migration |
