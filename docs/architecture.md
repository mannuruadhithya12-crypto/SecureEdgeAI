# Architecture — SecureEdgeMobile

## Overview

SecureEdgeMobile is an offline-first biometric authentication platform built on React Native.
All face detection, recognition, liveness verification, and anti-spoofing run entirely
on the device using TensorFlow Lite models via a GPU-accelerated worklet pipeline.

---

## Architectural Layers

```
┌──────────────────────────────────────────────────────────┐
│  Layer 1 — Presentation (React Native + TypeScript)      │
│  Screens · Components · Navigation · Theme               │
├──────────────────────────────────────────────────────────┤
│  Layer 2 — Application Logic (Hooks)                     │
│  useDatabase · useFaceAuth · useLiveness                 │
│  useSecurity · useSync                                   │
├──────────────────────────────────────────────────────────┤
│  Layer 3 — AI / ML Pipeline (Worklets)                   │
│  VisionCamera → BlazeFace → Quality → AntiSpoof          │
│  → MobileFaceNet → CosineSimilarity                      │
├──────────────────────────────────────────────────────────┤
│  Layer 4 — Security (Native C++ / Kotlin)                │
│  SecurityModule · Encryption · AuditLogger               │
├──────────────────────────────────────────────────────────┤
│  Layer 5 — Persistence (SQLite WAL)                      │
│  users · embeddings · sync_queue · audit_logs            │
└──────────────────────────────────────────────────────────┘
```

---

## Layer 1 — Presentation

### Navigation Stack

```
RootNavigator (Stack, fade animation)
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
│   ├── DashboardScreen (4 tabs: Home · History · Profile · Settings)
│   └── SecurityDashboardScreen
├── FaceAuthenticationScreen
└── RegistrationSuccessScreen (also at root for Mode B)
```

`FaceRegistration` exists at both root level and inside `AuthNavigator`:
- Root level: invoked from Dashboard with `{ activeUser }` → Mode B (update template)
- Auth level: invoked from Step3Review with `{ registrationData }` → Mode A (new user)

### Component Library (`src/components/`)

20 reusable components including:
- `AppHeader` — Consistent header with back action and right action slot
- `PrimaryButton` / `SecondaryButton` — Design-system buttons
- `UserCard` — Active user display with employee ID
- `StatusCard` — Color-coded status message (success/warning/error)
- `AttendanceCard` — Individual attendance record row
- `ProfileCard` — Profile detail field row
- `BottomTabBar` — 4-tab navigation bar
- `ProgressStepper` — Step indicator for onboarding
- `FaceBox` — Face bounding box overlay on camera

---

## Layer 2 — Application Logic (Hooks)

### `useDatabase`
Central data hook used by all screens.
- `loadAll()` — Fetches users from SQLite, resolves `activeUser` from secureStorage,
  loads all embeddings into `storedEmbeddings` cache keyed by `user.name`
- `handleSwitchUser()` — Updates activeUser + persists to secureStorage
- `handleClearAll()` — Wipes all users, embeddings, sync queue, and active profile
- `settings` — Loaded from EncryptedStorage (emulatorMode, cameraPosition, etc.)

### `useFaceAuth`
Authentication state machine.
- States: `IDLE → SCANNING → DETECTING → VERIFYING → AUTHENTICATED | REJECTED`
- `handleVerificationSuccess()` — Sets 30s session, resets failed attempts, logs auth count
- `handleVerificationFailure()` — Progressive lockout: 5/10/15 fails → 30s/2min/10min
- Rolling scores array (last 5 frames), requires 3 consecutive > 0.85

### `useLiveness`
Liveness state tracker.
- Tracks `livenessBlink` and `livenessHead` boolean flags
- `resetLivenessState()` called on face lost or multiple faces detected
- Stores timestamps via refs for cooldown calculations

### `useSecurity`
Device hardening monitor.
- Polls `SecurityModule` every 5 seconds (configurable)
- Exposes `hardeningRoot`, `hardeningDebugger`, `hardeningIntegrity`
- Only active when `settings.telemetryEnabled = true`

### `useSync`
Background sync manager.
- Starts/stops the AWS sync worker
- Monitors network state via `@react-native-community/netinfo`

---

## Layer 3 — AI / ML Pipeline

### Model Loading (`src/ai/modelSources.ts`)

```typescript
// Android: copy from APK assets to DocumentDirectory, load as file:// URI
await RNFS.copyFileAssets('blazeface_front.tflite', destPath);
const model = await loadTensorflowModel({ url: `file://${destPath}` }, ['android-gpu']);

// iOS: require() directly
const model = await loadTensorflowModel(require('../assets/models/blazeface_front.tflite'));
```

GPU delegate used first; CPU fallback on failure.
Models are passed into worklets via `NitroModules.box()` / `.unbox()` (zero-copy bridge).

### Frame Processor Pipeline

```
useFrameProcessor (runs at 4 FPS via runAtTargetFps)
│
├─ 1. Resize frame → 128×128 float32 (vision-camera-resize-plugin)
├─ 2. blazeModel.runSync([buffer]) → regressors + classificators
├─ 3. decodeBlazeFaceBoxes() + NMS (confidence ≥ 0.50)
├─ 4. Face quality validation (blur, alignment, size, occlusion)
├─ 5. Anti-spoof 4-signal check (worklet, cached every 200ms)
├─ 6. Resize face crop → 112×112 float32
├─ 7. faceModel.runSync([cropBuffer]) → 192-dim Float32Array
└─ 8. handleFrameResult() via useRunOnJS → JS thread
```

### Liveness Detection

**Blink Detection (`src/liveness/blinkDetection.ts`)**
- Extracts 3×3 pixel patch around eye keypoints from 128×128 BlazeFace image
- Computes grayscale variance → EMA smoothing (α = 0.55)
- Valley pattern detection: variance drop + recovery, 100–450ms window
- Cooldown: 1.5s between registered blinks

**Head Movement (`src/liveness/headMovement.ts`)**
- Normalizes nose tip X/Y relative to bounding box center + size
- EMA smoothing (α = 0.50), 10-frame history
- Threshold: X range > 0.085 or Y range > 0.085
- Requires 3 consecutive movement frames, 1.5s cooldown

**Challenge-Response (`src/liveness/challengeResponse.ts`)**
- Fisher-Yates shuffle → 3 random steps from {BLINK, HEAD_LEFT, HEAD_RIGHT, LOOK_UP, LOOK_DOWN}
- 6s per step, 25s session timeout
- States: PENDING → PASSED | FAILED | EXPIRED

---

## Layer 4 — Security

### Native SecurityModule (C++ via Nitro Modules)

Located in `cxx/` — compiled via CMake into `libSecurityModule.so`.

All calls wrapped with 5-second timeout:
```typescript
Promise.race([SecurityModule.isDeviceRooted(), timeout(5000)])
```

DEV mode bypass: all checks return clean when `__DEV__ === true`.

### Encryption (`src/security/encryption.ts`)

```
Algorithm:  AES-256-CBC
Key:        Android Keystore → react-native-keychain
Format:     hex(IV) + ':' + hex(ciphertext)
Library:    react-native-aes-crypto
```

Encrypted fields: `users.name`, `users.employee_id`, `embeddings.embedding` (as hex BLOB).

### Audit Logger (`src/security/auditLogger.ts`)

All events written synchronously to `audit_logs` table.
Rolling limit: 5,000 entries — oldest deleted when exceeded.

---

## Layer 5 — Persistence

### SQLite Configuration

- **File:** `SecureEdge.db`
- **Mode:** WAL (Write-Ahead Logging) — concurrent reads with async writes
- **Schema version:** 2 (tracked via `PRAGMA user_version`)
- **Encryption:** AES-256-CBC on all PII and biometric fields
- **Recovery:** Encrypted backup at `secure_edge_backup.enc` in DocumentDirectory

### Repository Pattern

Each table has a dedicated repository:
- `userRepository.ts` — encrypt on write, decrypt on read
- `embeddingRepository.ts` — Float32Array → base64 → AES → hex BLOB
- `attendanceQueueRepository.ts` — PENDING → SYNCING → SYNCED/FAILED, max 5 retries

### Offline-First Design

All features work with zero network connectivity:
1. Registration: fully local (SQLite + secureStorage)
2. Authentication: fully local (SQLite + worklet inference)
3. Attendance: queued locally in `sync_queue`, flushed to AWS when online
4. Security checks: fully local (native module, no network calls)

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Worklets for inference | Zero main-thread blocking; camera frames processed at 4 FPS |
| Nitro Modules for bridge | Zero-copy Float32Array transfer between JS and C++ |
| WAL mode on SQLite | Allows reading while writing; critical for concurrent auth + logging |
| `hex(embedding)` in queries | Reliable BLOB retrieval across all SQLite driver versions |
| All-user embedding search | Face auth matches against all registered users, not just last active |
| AES-256 on all biometric data | Compliance with biometric data protection standards |
| arm64-v8a only APK | 50%+ size reduction vs universal APK; all modern Android devices |

See [`docs/architecture_diagrams.md`](architecture_diagrams.md) for Mermaid flow diagrams.
