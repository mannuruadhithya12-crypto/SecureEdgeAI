# Security — SecureEdgeMobile

## Security Architecture Overview

SecureEdgeMobile implements a 6-layer defense-in-depth security model.
Every layer operates independently — compromise of one layer does not bypass others.

```
Layer 1  Device Trust       Root, Frida, Magisk, Xposed, Debugger, APK Integrity
Layer 2  Liveness           Blink + Head Movement + Challenge-Response
Layer 3  Anti-Spoof         4-signal composite score (photo, replay, texture, motion)
Layer 4  Face Match         MobileFaceNet cosine similarity ≥ 0.85 (3-frame consensus)
Layer 5  Data Encryption    AES-256-CBC at rest, Android Keystore key management
Layer 6  Audit Trail        5,000-entry rolling tamper-evident log in SQLite
```

---

## Layer 1 — Device Trust

### SecurityModule (`src/security/deviceHardening.ts`)

All native checks are implemented in C++ via Nitro Modules (`cxx/`).
Each call has a 5-second timeout wrapper to prevent ANR.

```typescript
SecurityModule.isDeviceRooted()         → boolean
SecurityModule.isDebuggerAttached()     → boolean
SecurityModule.checkApkSignature()      → string (SHA-256)
SecurityModule.getSecurityReport()      → SecurityReport
SecurityModule.getFridaReport()         → FridaReport
SecurityModule.getMagiskReport()        → MagiskReport
SecurityModule.getHookReport()          → HookReport
```

### Root Detection (`getSecurityReport().rooted`)
- Checks for `su` binary in known paths
- Checks for Magisk app package
- Checks for SuperSU, KingRoot, and other root apps
- Checks `/system/bin/`, `/system/xbin/`, `/sbin/`, `/vendor/bin/`

### Frida Detection (`getFridaReport()`)
```typescript
{
  fridaDetected: boolean;          // any Frida indicator found
  fridaPortsDetected: boolean;     // port 27042 or 27043 open
  fridaLibrariesDetected: boolean; // frida-agent*.so in /proc/maps
  suspiciousProcesses: string[];   // frida-server, gum-js-loop, etc.
}
```

### Magisk Detection (`getMagiskReport()`)
```typescript
{
  magiskDetected: boolean;
  zygiskDetected: boolean;         // Zygisk module injection
  suspiciousPaths: string[];       // /data/adb/magisk, /sbin/.magisk
  suspiciousMounts: string[];      // bind-mounted /system paths
}
```

### Xposed / LSPosed Detection (`getHookReport()`)
```typescript
{
  xposedDetected: boolean;
  lsposedDetected: boolean;
  runtimeHooksDetected: boolean;   // Method replacement at runtime
}
```

### APK Integrity Check
```typescript
const signature = await SecurityModule.checkApkSignature();
// Returns SHA-256 of the signing certificate
// Compared against expected value at build time
// Mismatch → APK_TAMPERED audit event
```

### DEV Mode

All security checks are bypassed when `__DEV__ === true`.
This is enforced by React Native's bundler — release APKs never have `__DEV__ = true`.
Never add a runtime toggle for security checks.

---

## Layer 5 — Encryption

### Algorithm

```
Algorithm:  AES-256-CBC
Key size:   256 bits (32 bytes)
IV size:    128 bits (16 bytes), randomly generated per encryption
Padding:    PKCS7
Library:    react-native-aes-crypto
```

### Key Management

```typescript
// Key generated once per device install, stored in Android Keystore
// Never leaves the Keystore boundary
const key = await getEncryptionKey();  // → Keychain.getGenericPassword({ service: 'SecureEdgeMobileEncryptionKey' })
```

If Keystore is unavailable (emulator testing), a fallback key is used.
**Fallback key must never be used on production deployments.**

### Encrypted Fields

| Table | Column | Type |
|---|---|---|
| users | name | TEXT — AES-256-CBC |
| users | employee_id | TEXT — AES-256-CBC |
| embeddings | embedding | BLOB — base64 → AES-256-CBC → hex |
| (EncryptedStorage) | password_* | react-native-encrypted-storage (hardware AES) |
| (EncryptedStorage) | active_user_name | react-native-encrypted-storage |
| (EncryptedStorage) | details_* | react-native-encrypted-storage |

### Encrypted Format

```
Ciphertext format: "IV_HEX:CIPHERTEXT_HEX"
IV:               32-char hex string (16 bytes)
Ciphertext:       hex-encoded AES ciphertext
```

---

## Layer 6 — Audit Trail

### Audit Logger (`src/security/auditLogger.ts`)

All authentication and security events are written synchronously to the `audit_logs` table.

**Standard events:**

| Event | Trigger | Severity |
|---|---|---|
| `AUTH_SUCCESS` | Face match + liveness pass | INFO |
| `AUTH_FAILURE` | Face mismatch | WARNING |
| `SPOOF_DETECTED` | Anti-spoof score below threshold | HIGH |
| `REGISTRATION_SUCCESS` | New user enrolled | INFO |
| `REGISTRATION_FAILED` | Enrollment rejected | WARNING |
| `ROOT_DETECTED` | Root check positive | CRITICAL |
| `FRIDA_DETECTED` | Frida detected | CRITICAL |
| `APK_TAMPERED` | Signature mismatch | CRITICAL |
| `MULTIPLE_FACE_DETECTED` | 2+ faces in frame | WARNING |

**Retention:** 5,000 entries rolling. Oldest deleted automatically.

---

## Threat Model Summary

| Threat | Mitigation | Status |
|---|---|---|
| Printed photo attack | Signal 1 (nose variance) + Signal 2 (texture) | ✅ Detected |
| Screen replay attack | Signal 2 (Moiré) + Signal 3 (brightness) | ✅ Detected |
| Video deepfake | Partial — liveness + motion consistency | ⚠️ Partial |
| Liveness bypass | Randomized challenge-response (non-deterministic) | ✅ Protected |
| Root/Magisk | Native SecurityModule multi-check | ✅ Detected |
| Frida injection | Port + library + process scan | ✅ Detected |
| APK tampering | SHA-256 signature verification | ✅ Detected |
| Data exfiltration | AES-256-CBC + Android Keystore | ✅ Protected |
| Network interception | Only attendance sync uses network (HTTPS) | ✅ Protected |
| Brute force (face) | Progressive lockout 5/10/15 attempts | ✅ Protected |

---

## Security Dashboard

`SecurityDashboardScreen` displays real-time device trust state:

| Check | Display | Data Source |
|---|---|---|
| Root Status | 🔴 ROOTED / 🟢 CLEAN | `SecurityReport.rooted` |
| Frida Status | 🔴 DETECTED / 🟢 CLEAN | `FridaReport.fridaDetected` |
| Magisk Status | 🔴 DETECTED / 🟢 CLEAN | `MagiskReport.magiskDetected` |
| Xposed Status | 🔴 DETECTED / 🟢 CLEAN | `HookReport.xposedDetected` |
| APK Integrity | 🔴 TAMPERED / 🟢 VALID | `checkApkSignature()` |
| Debugger | 🔴 ATTACHED / 🟢 NONE | `isDebuggerAttached()` |

Each check shows: icon + status label + last-checked timestamp.
Checks run every 5 seconds via `useSecurity` hook.
