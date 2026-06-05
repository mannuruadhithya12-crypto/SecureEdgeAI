# SecureEdgeMobile — Project Context

> This file is the **single source of truth** for AI agents working on this repository.
> Load this file first before any task. It reduces token consumption and prevents
> accidental architecture modifications.

---

## Project Identity

| Field | Value |
|---|---|
| **Project Name** | SecureEdgeMobile |
| **Internal ID** | SecureEdgeAI |
| **Package** | `com.secureedgemobile` |
| **Version** | 1.0 (versionCode 1) |
| **Platform** | Android (arm64-v8a only) |
| **APK Budget** | < 19 MB (hard limit) |
| **Target Environment** | Zero-network / Offline-first |

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **UI Framework** | React Native | 0.85.3 |
| **Language** | TypeScript | Latest |
| **React** | React | 19.2.3 |
| **Camera** | react-native-vision-camera | 4.6.4 |
| **ML Inference** | react-native-fast-tflite | 3.0.1 |
| **Frame Processing** | vision-camera-resize-plugin | 3.2.0 |
| **Native Bridge** | react-native-nitro-modules | 0.35.7 |
| **Background JS** | react-native-worklets-core | 1.6.3 |
| **Local Database** | react-native-sqlite-storage | 6.0.1 |
| **Encryption** | react-native-aes-crypto | 3.3.0 |
| **Secure Storage** | react-native-encrypted-storage | 4.0.3 |
| **Keychain** | react-native-keychain | 10.0.0 |
| **Navigation** | @react-navigation/native | 7.2.4 |
| **Network State** | @react-native-community/netinfo | 12.0.1 |
| **Build Engine** | Hermes JS engine + CMake (C++) | — |

---

## AI / ML Models (FROZEN — DO NOT REPLACE)

| Model | File | Input Shape | Purpose |
|---|---|---|---|
| **BlazeFace Front** | `blazeface_front.tflite` | 128×128×3 RGB float32 | Real-time face detection ~4 FPS |
| **BlazeFace Back** | `blazeface_back.tflite` | 256×256×3 RGB float32 | High-res face detection |
| **MobileFaceNet** | `mobilefacenet.tflite` | 112×112×3 RGB float32 | 192-dim face embedding generation |

**Loading strategy (Android):** Models are copied from APK assets → `DocumentDirectoryPath` via `RNFS.copyFileAssets`, loaded as `file://` URIs via `loadTensorflowModel(model, ['android-gpu'])` with CPU fallback.

**Inference pipeline:**
1. VisionCamera frame → resize-plugin → 128×128 float32 buffer
2. BlazeFace → bounding boxes + 6 keypoints (confidence threshold ≥ 0.50)
3. Anti-spoof pipeline on BlazeFace pixels
4. Face crop → resize → 112×112 float32
5. MobileFaceNet → 192-dim embedding Float32Array
6. Cosine similarity vs stored embeddings (threshold ≥ **0.85**)

---

## Core Features

| Feature | Status | Key Files |
|---|---|---|
| **Face Registration** | ✅ Active | `src/screens/face/FaceRegistrationScreen.tsx` |
| **Face Authentication** | ✅ Active | `src/screens/FaceAuthenticationScreen.tsx` |
| **Attendance Tracking** | ✅ Active | `src/screens/AttendanceScreen.tsx` |
| **Anti-Spoofing** | ✅ Active | `src/security/antiSpoofing.ts` |
| **Liveness Detection** | ✅ Active | `src/liveness/` |
| **Security Dashboard** | ✅ Active | `src/screens/SecurityDashboardScreen.tsx` |
| **Offline Sync Queue** | ✅ Active | `src/sync/` |
| **AES-256 Encryption** | ✅ Active | `src/security/encryption.ts` |
| **Root / Frida Detection** | ✅ Active | `src/security/deviceHardening.ts` |
| **Audit Logging** | ✅ Active | `src/security/auditLogger.ts` |

---

## SQLite Database Schema (FROZEN — DO NOT MODIFY)

**Database:** `SecureEdge.db` | **WAL mode** | **Schema version: 2**

```sql
-- v1: Core biometric tables
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,           -- AES-256-CBC encrypted
  employee_id TEXT UNIQUE,      -- AES-256-CBC encrypted
  embedding TEXT,               -- AES-256-CBC encrypted JSON float array (legacy)
  created_at TEXT
);

CREATE TABLE embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  embedding BLOB,               -- base64 Float32Array, AES-256 encrypted as hex
  embedding_version TEXT,       -- "MobileFaceNet_v1"
  created_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_user_id ON embeddings(user_id);

-- v2: Sync and audit
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload BLOB,
  payload_hash TEXT UNIQUE,
  status TEXT,                  -- PENDING | SYNCING | FAILED | SYNCED
  retry_count INTEGER,
  last_retry_at TEXT,
  created_at TEXT
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  description TEXT,
  timestamp TEXT NOT NULL
);
```

**Repositories:** `userRepository.ts` · `embeddingRepository.ts` · `attendanceQueueRepository.ts`

---

## Navigation Architecture

```
RootNavigator (Stack, fade)
├── SplashScreen
├── AuthNavigator (Stack, slide_from_right)
│   ├── WelcomeScreen
│   ├── Step1PersonalInfoScreen
│   ├── Step2CredentialsScreen
│   ├── Step3ReviewScreen
│   ├── FaceRegistrationScreen
│   ├── RegistrationSuccessScreen
│   └── LoginScreen
├── MainNavigator (Stack, slide_from_right)
│   ├── DashboardScreen (4 tabs: Home | History | Profile | Settings)
│   └── SecurityDashboardScreen
└── FaceAuthenticationScreen
```

---

## Security Architecture

| Control | Implementation |
|---|---|
| Root Detection | `SecurityModule.isDeviceRooted()` (native) |
| Frida Detection | `SecurityModule.getFridaReport()` — ports + libraries + processes |
| Magisk Detection | `SecurityModule.getMagiskReport()` — paths + mounts + zygisk |
| Xposed/Hook Detection | `SecurityModule.getHookReport()` — LSPosed + runtime hooks |
| APK Integrity | `SecurityModule.checkApkSignature()` → SHA-256 |
| Debugger Detection | `SecurityModule.isDebuggerAttached()` |
| Data Encryption | AES-256-CBC, key in Android Keystore |
| Audit Trail | Rolling 5000-entry log in `audit_logs` table |
| Timeout | All native security calls: 5s timeout |
| Dev Mode | All checks bypassed in DEV (non-release) builds |

---

## Anti-Spoof & Liveness Architecture

### Anti-Spoof Score (0–100)
| Signal | Weight | Detection |
|---|---|---|
| Face Quality | 25 pts | blur, lighting, occlusion, alignment, size |
| Blink Detection | 20 pts | EAR valley pattern (100–450ms window) |
| Head Movement | 15 pts | Yaw-based nose position range > 0.085 |
| Photo Attack Guard | 15 pts | Nose keypoint variance < 0.000005 over 15 frames |
| Replay Attack Guard | 15 pts | Screen moiré / brightness emission flatness |
| Challenge-Response | 10 pts | All randomized steps completed |

**Thresholds:** Registration ≥ **80** · Authentication ≥ **70**

### Challenge-Response Pool
`BLINK | HEAD_LEFT | HEAD_RIGHT | LOOK_UP | LOOK_DOWN` — 3 random steps, 6s per step, 25s total session.

---

## APK Configuration

| Setting | Value |
|---|---|
| ABI | arm64-v8a only (no universal APK) |
| Proguard | Enabled in release |
| Shrink Resources | Enabled |
| Hermes | Enabled |
| Resource Configs | "en" only |
| NDK | CMake with Nitro modules (cxx/) |

---

## Project Constraints (ABSOLUTE)

1. **APK must remain < 19 MB** — every change must include a size impact estimate
2. **Offline-first** — no feature may require a network connection to function
3. **No cloud dependency** — all biometric processing runs on-device
4. **Preserve all AI models** — BlazeFace and MobileFaceNet are not replaceable
5. **Preserve SQLite schema** — no destructive migrations, no duplicate tables
6. **Preserve existing security controls** — never reduce detection capabilities
7. **AES-256 encryption at rest** — all PII and biometric data must remain encrypted

---

## File Map (Quick Reference)

```
src/
  ai/
    modelSources.ts         ← Model loading (Android + iOS)
    faceQuality.ts          ← Face quality validation
    antiSpoofScoreCalculator.ts ← Combined 0-100 score
  liveness/
    blinkDetection.ts       ← EAR valley blink detector
    headMovement.ts         ← Yaw-based head movement
    challengeResponse.ts    ← Randomized challenge-response
    livenessValidation.ts   ← Combined liveness result
  security/
    antiSpoofing.ts         ← 4-signal spoof detection (worklet)
    photoAttackDetection.ts ← Photo attack wrapper
    replayDetection.ts      ← Screen replay wrapper
    deviceHardening.ts      ← Root/Frida/Magisk/Xposed detection
    encryption.ts           ← AES-256-CBC encrypt/decrypt
    auditLogger.ts          ← Audit log writer (5000 entry cap)
  database/
    database.ts             ← DB init, WAL, migrations, recovery
    userRepository.ts       ← User CRUD
    embeddingRepository.ts  ← Embedding insert/read
    attendanceQueueRepository.ts ← Sync queue management
  screens/
    face/
      FaceRegistrationScreen.tsx
    FaceAuthenticationScreen.tsx
    SecurityDashboardScreen.tsx
    DashboardScreen.tsx
  navigation/
    RootNavigator.tsx
    AuthNavigator.tsx
    MainNavigator.tsx
ai-models/
  detection/
    blazeface_front.tflite
    blazeface_back.tflite
  recognition/
    mobilefacenet.tflite
  docs/
    AI_PIPELINE.md
    MODEL_INPUTS.md
    LIVENESS_STRATEGY.md
    PERFORMANCE_OPTIMIZATION.md
android/
  app/
    build.gradle            ← arm64-v8a, ProGuard, Hermes
cxx/                        ← Nitro C++ modules
```
