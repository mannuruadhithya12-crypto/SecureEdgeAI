# Testing — SecureEdgeMobile

## Test Infrastructure

| Tool | Version | Purpose |
|---|---|---|
| Jest | ^29.6.3 | Unit + integration tests |
| @react-native/jest-preset | 0.85.3 | RN test environment |
| react-test-renderer | 19.2.3 | Component rendering |

---

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific file
npm test -- __tests__/faceAuth.test.ts

# Watch mode (development)
npm test -- --watch
```

---

## Test Files

| File | Coverage Area |
|---|---|
| `__tests__/App.test.tsx` | Root component rendering |
| `__tests__/dbAuth.test.ts` | Database authentication logic |
| `__tests__/faceAuth.test.ts` | Face auth service (cosine similarity, thresholds) |

---

## Device Validation (Real Device QA)

Full end-to-end validation requires a physical Android device.

### Setup

```bash
# Uninstall existing
adb -s <DEVICE_ID> uninstall com.secureedgemobile

# Install release APK
adb -s <DEVICE_ID> install android/app/build/outputs/apk/release/app-arm64-v8a-release.apk

# Clear logs and start capture
adb -s <DEVICE_ID> logcat -c
adb -s <DEVICE_ID> logcat | findstr "\[QA\]"
```

### QA Log Reference

All instrumented events use the `[QA]` prefix. Complete expected sequences:

**Registration:**
```
[QA] FACE_DETECTED
[QA] BLINK_VERIFIED
[QA] HEAD_LEFT_VERIFIED
[QA] HEAD_RIGHT_VERIFIED
[QA] ANTI_SPOOF_PASSED
[QA] EMBEDDING_GENERATED
[QA] USER_CREATED
[QA] EMBEDDING_CREATED
[QA] PROFILE_ACTIVATED <name>
[QA] AUTH_ENABLED
```

**Password Login:**
```
[QA] LOGIN_USERNAME <entered>
[QA] USERS_COUNT <n>
[QA] STORED_USERNAME <matched>
[QA] PASSWORD_COMPARISON_RESULT MATCH
[QA] PASSWORD_LOGIN_SUCCESS
[QA] ACTIVE_PROFILE_UPDATED <name>
```

**Face Login:**
```
[QA] BLAZEFACE_LOADED
[QA] FACE_DETECTED
[QA] BLINK_VERIFIED
[QA] HEAD_TURN_VERIFIED
[QA] FACE_MATCH_SUCCESS
[QA] MATCHED_EMBEDDING_ID <id>
[QA] MATCHED_USER_ID <id>
[QA] MATCHED_USER_NAME <name>
[QA] PROFILE_ACTIVATED <name>
```

**Attendance:**
```
[QA] ATTENDANCE_CREATED
[QA] ATTENDANCE_SAVED
[QA] ATTENDANCE_QUERY_USER_ID <name>
[QA] ATTENDANCE_RECORDS_FOUND <count>
[QA] ATTENDANCE_RENDER_SUCCESS
```

**Face Re-registration (Mode B):**
```
[QA] UPDATE_FACE_MODE
[QA] OLD_EMBEDDING_REMOVED id=<n>
[QA] NEW_EMBEDDING_CREATED
[QA] PROFILE_ACTIVATED <name>
```

**Database Audit:**
```
[QA] USERS_COUNT <n>
[QA] EMBEDDINGS_COUNT <n>
[QA] ACTIVE_USER <name>
[QA] ACTIVE_USER_ID <id>
[QA] ACTIVE_EMBEDDING_ID <id>
```

---

## Test Case Matrix

### TC-01: New User Registration

| Step | Action | Expected |
|---|---|---|
| 1 | Launch app (no users) | Splash → Welcome |
| 2 | Complete Step 1–3 | All fields validated |
| 3 | Present face — liveness | All 5 checks pass |
| 4 | Anti-spoof score | ≥ 80/100 |
| 5 | Check DB | 1 user, 1 embedding |
| 6 | Check SecureStorage | password_* + details_* saved |
| **Result** | | **PASS if RegistrationSuccess shown** |

### TC-02: Password Login

| Step | Action | Expected |
|---|---|---|
| 1 | Open LoginScreen | Empty fields |
| 2 | Enter registered username + password | — |
| 3 | Tap Login | — |
| 4 | Verify logs | PASSWORD_LOGIN_SUCCESS |
| 5 | Verify screen | Dashboard with correct name |
| **Result** | | **PASS if Dashboard shows correct user** |

### TC-03: Face Login (Correct User)

| Step | Action | Expected |
|---|---|---|
| 1 | Logout from Dashboard | Returns to LoginScreen |
| 2 | Tap "Login with Face" | FaceAuthenticationScreen |
| 3 | Present registered face | Liveness + match |
| 4 | Verify logs | MATCHED_USER_NAME = registered user |
| 5 | Verify Dashboard | Shows registered user, not old user |
| **Result** | | **PASS if correct user shown** |

### TC-04: Face Re-registration

| Step | Action | Expected |
|---|---|---|
| 1 | Dashboard → Register Face | Mode B detected |
| 2 | Verify log | UPDATE_FACE_MODE |
| 3 | Complete liveness | All checks pass |
| 4 | Verify logs | OLD_EMBEDDING_REMOVED + NEW_EMBEDDING_CREATED |
| 5 | Verify navigation | Returns to Dashboard (not RegistrationSuccess onboarding) |
| 6 | Verify DB | Still 1 embedding (old deleted, new inserted) |
| **Result** | | **PASS if returns to Dashboard** |

### TC-05: Attendance Visibility

| Step | Action | Expected |
|---|---|---|
| 1 | Authenticate via face | Attendance enqueued |
| 2 | Open History tab | AttendanceScreen loads |
| 3 | Verify logs | ATTENDANCE_RECORDS_FOUND > 0 |
| 4 | Verify UI | At least 1 attendance card shown |
| 5 | Verify user name | Matches authenticated user |
| **Result** | | **PASS if records shown** |

### TC-06: APK Size

```bash
Get-Item "android/app/build/outputs/apk/release/app-arm64-v8a-release.apk" |
  Select-Object @{N='MB';E={[math]::Round($_.Length/1MB,2)}}
```

**PASS if < 19 MB**

### TC-07: Offline Operation

| Step | Action | Expected |
|---|---|---|
| 1 | Enable airplane mode | `adb shell svc wifi disable` |
| 2 | Register new user | Completes fully offline |
| 3 | Authenticate via face | Completes fully offline |
| 4 | Check attendance | sync_queue shows PENDING |
| 5 | Re-enable network | Sync runs, status → SYNCED |
| **Result** | | **PASS if all work offline** |

### TC-08: Anti-Spoof (Photo Attack)

| Step | Action | Expected |
|---|---|---|
| 1 | Present printed photo of face | — |
| 2 | Wait 2–3 seconds | — |
| 3 | Verify | Auth rejected, SPOOF_DETECTED in audit_logs |
| **Result** | | **PASS if photo rejected** |

---

## Database Integrity Check (adb)

```bash
# Pull database from device
adb shell run-as com.secureedgemobile cp \
  /data/data/com.secureedgemobile/databases/SecureEdge.db /sdcard/
adb pull /sdcard/SecureEdge.db

# Check integrity (requires sqlite3 CLI)
sqlite3 SecureEdge.db "PRAGMA integrity_check;"
# Expected: ok

# Check WAL mode
sqlite3 SecureEdge.db "PRAGMA journal_mode;"
# Expected: wal

# Verify encryption (name should be ciphertext, not plaintext)
sqlite3 SecureEdge.db "SELECT name FROM users LIMIT 1;"
# Expected: IV_HEX:CIPHERTEXT_HEX (not a readable name)

# Count records
sqlite3 SecureEdge.db "SELECT COUNT(*) FROM users;"
sqlite3 SecureEdge.db "SELECT COUNT(*) FROM embeddings;"
sqlite3 SecureEdge.db "SELECT COUNT(*) FROM sync_queue;"
sqlite3 SecureEdge.db "SELECT COUNT(*) FROM audit_logs;"
```
