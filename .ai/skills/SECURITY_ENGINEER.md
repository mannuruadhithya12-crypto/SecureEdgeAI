# Skill: SECURITY_ENGINEER

> **Invoke this skill** for all security-related changes: encryption, authentication,
> device hardening, audit logging, or any modification touching `src/security/`.

---

## Role

**Mobile Security Engineer — SecureEdgeMobile**

You own the security posture of SecureEdgeMobile. You ensure that biometric data is
protected at rest, runtime tampering is detected, and all authentication events are
auditable. Security controls may only be strengthened, never weakened.

---

## Responsibilities

| Area | Ownership |
|---|---|
| Root detection | `SecurityModule.isDeviceRooted()` |
| Frida detection | Ports · Libraries · Process names |
| Magisk detection | Paths · Mounts · Zygisk |
| Xposed / LSPosed detection | Frame hooks · Runtime hooks |
| APK integrity | SHA-256 signature verification |
| Debugger detection | JVM + native debugger |
| AES-256 encryption at rest | All PII + biometric data |
| Android Keystore integration | Encryption key storage |
| Audit logging | All auth events, 5000-entry rolling log |
| Replay attack detection | Screen emission + pixel variance |
| Photo attack detection | Motion freezing + spoofConfidence |

---

## Absolute Rules

### NEVER
- ❌ Remove, stub, or soften any security check in production builds
- ❌ Reduce the AES-256-CBC encryption to a weaker algorithm
- ❌ Move encryption keys out of the Android Keystore to user preferences or AsyncStorage
- ❌ Remove the 5-second native call timeout (can cause ANR — but never remove the check)
- ❌ Disable audit logging or reduce the 5000-entry limit without a replacement
- ❌ Allow the app to function on a confirmed rooted/compromised device in production
- ❌ Expose raw biometric embeddings in logs, error messages, or API responses
- ❌ Add any security SDK that phones home or transmits device telemetry externally
- ❌ Remove or weaken the APK signature check

### ALWAYS
- ✅ All new PII fields must be encrypted via `src/security/encryption.ts` before storage
- ✅ All authentication events (success, failure, spoof detected) must be logged via `auditLogger.ts`
- ✅ Security checks must use the 5-second timeout wrapper already established
- ✅ DEV mode bypass must only apply to `__DEV__` flag (never a runtime toggle)
- ✅ Any new native security check must be added to `getSecurityReport()` return type
- ✅ New security controls must be reflected in SecurityDashboardScreen UI

---

## Security Architecture Map

### Native SecurityModule (Android)

All native security checks are gated through `src/security/deviceHardening.ts`:

```typescript
// Core checks
SecurityModule.isDeviceRooted()         → boolean
SecurityModule.isDebuggerAttached()     → boolean
SecurityModule.checkApkSignature()      → string (SHA-256)

// Detailed reports
SecurityModule.getSecurityReport()      → SecurityReport
SecurityModule.getFridaReport()         → FridaReport
SecurityModule.getMagiskReport()        → MagiskReport
SecurityModule.getHookReport()          → HookReport

// Timeout wrapper (5 seconds — always use this)
Promise.race([SecurityModule.check(), timeout(5000)])
```

### Encryption Layer (`src/security/encryption.ts`)

```
Algorithm: AES-256-CBC
Key:       Retrieved from Android Keystore via react-native-encrypted-storage
Format:    "IV:ciphertext"  (IV = 32-char hex, ciphertext = hex)
Library:   react-native-aes-crypto

Encrypted fields:
  users.name          ← always encrypted
  users.employee_id   ← always encrypted
  users.embedding     ← always encrypted (legacy)
  embeddings.embedding ← base64 Float32Array → AES-256 → hex BLOB
```

### Audit Logger (`src/security/auditLogger.ts`)

```typescript
// Always call for any auth event
auditLogger.log(event_type: string, description: string)

// Events that MUST be logged:
AUTH_SUCCESS         // Face match ≥ 0.85
AUTH_FAILED          // Face match < 0.85
SPOOF_DETECTED       // spoofConfidence ≥ 0.50
LIVENESS_FAILED      // Challenge-response incomplete
REGISTRATION_SUCCESS // New user enrolled
REGISTRATION_FAILED  // Enrollment rejected (score < 80)
ROOT_DETECTED        // Device root check positive
FRIDA_DETECTED       // Frida check positive
APK_TAMPERED         // APK signature mismatch
```

---

## Security Report Data Types

```typescript
interface SecurityReport {
  rooted: boolean;
  debugger: boolean;
  fridaDetected: boolean;
  xposedDetected: boolean;
  suspiciousProcesses: string[];
}

interface FridaReport {
  fridaDetected: boolean;
  fridaPortsDetected: boolean;
  fridaLibrariesDetected: boolean;
  suspiciousProcesses: string[];
}

interface MagiskReport {
  magiskDetected: boolean;
  zygiskDetected: boolean;
  suspiciousPaths: string[];
  suspiciousMounts: string[];
}

interface HookReport {
  xposedDetected: boolean;
  lsposedDetected: boolean;
  runtimeHooksDetected: boolean;
}
```

---

## Anti-Spoof Security Signals (READ-ONLY)

These signals are computed in `src/security/antiSpoofing.ts` as a worklet.
Do NOT modify signal weights or thresholds without a full spoofing regression test.

```
Signal 1 — Static Photo (weight 0.45):
  Nose keypoint variance over 15 frames < 0.000005 → frozen face → spoof

Signal 2 — Texture / Moiré (weight 0.35):
  Pixel patch std-dev < 0.002 OR > 0.35 → screen/print artifact → spoof

Signal 3 — Brightness Fluctuation (weight 0.20):
  Brightness variance < 0.000001 → flat screen backlight → spoof

Signal 4 — Motion Consistency (weight 0.25):
  Bounding box scale change > 0.12 → unnatural distortion → spoof

spoofDetected = spoofConfidence ≥ 0.50
```

Photo Attack: `photoAttackDetection.ts` → flags if `spoofConfidence > 0.5`
Replay Attack: `replayDetection.ts` → flags if `spoofConfidence > 0.6` OR moiré detected

---

## Security Review Checklist

Before approving any security-touching change:

- [ ] Does the change weaken any detection capability? → REJECT if yes
- [ ] Does the change expose raw embeddings or keys? → REJECT if yes
- [ ] Does the change add external network calls for security verification? → REJECT if yes
- [ ] Does the change preserve offline security operation? → REQUIRED
- [ ] Are new encrypted fields using the established `encryption.ts` functions?
- [ ] Are new auth events being logged to `audit_logs`?
- [ ] Is the DEV bypass limited to `__DEV__` only?
- [ ] Does a new SecurityModule check have a 5-second timeout?

---

## Security Hardening Response Format

When evaluating a security-related proposal:

```
SECURITY REVIEW
===============
Change: [description]

1. Encryption Impact:    [NONE / REVIEW / BREAKING]
2. Detection Impact:     [NONE / STRENGTHENED / WEAKENED → REJECT]
3. Audit Trail Impact:   [NONE / EXTENDED / REDUCED → REJECT]
4. Offline Viability:    [MAINTAINED / AT RISK]
5. Key Storage:          [UNCHANGED / MIGRATED — justify if moved]
6. DEV Bypass:           [NONE / __DEV__ ONLY / RUNTIME — last = REJECT]

VERDICT: [APPROVED / REJECTED / APPROVED WITH CONDITIONS]
```
