# Changelog

All notable changes to SecureEdgeMobile are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2026-06-05

### 🎉 Initial Production Release

#### Features Added

**Registration**
- 4-step onboarding wizard: Personal Info → Credentials → Review → Biometric Enrollment
- Real-time BlazeFace face detection during enrollment (128×128, confidence ≥ 0.50)
- MobileFaceNet 192-dimensional face embedding generation (112×112 RGB float32)
- Anti-spoof score gate: registration requires score ≥ 80/100
- AES-256-CBC encryption of all biometric data at rest
- Android Keystore-backed encryption key management

**Face Authentication**
- Real-time frame processor pipeline at 4 FPS using VisionCamera worklets
- Multi-user face matching: searches ALL registered users' embeddings
- 3-frame rolling consensus required (rolling avg > 0.85 with 3 consecutive passes)
- Cosine similarity threshold: ≥ 0.85
- Blink liveness detection: EAR valley pattern, 100–450ms window
- Head movement liveness: yaw-based nose tracking, range > 0.085
- Lockout system: progressive timeouts at 5/10/15 failed attempts (30s/2min/10min)
- Emulator mode: full pipeline simulation for development

**Liveness Detection**
- Blink detection with EMA smoothing (α = 0.55), 1.5s cooldown
- Head movement detection with EMA smoothing (α = 0.50), 10-frame history
- Randomized challenge-response: 3 of 5 challenges (BLINK, HEAD_LEFT, HEAD_RIGHT, LOOK_UP, LOOK_DOWN)
- 6-second per-step timeout, 25-second session timeout

**Anti-Spoofing**
- Signal 1 — Static photo detection (weight 0.45): nose keypoint variance < 0.000005 over 15 frames
- Signal 2 — Texture/Moiré detection (weight 0.35): pixel patch std-dev < 0.002 or > 0.35
- Signal 3 — Brightness fluctuation (weight 0.20): brightness variance < 0.000001
- Signal 4 — Motion consistency (weight 0.25): bounding box scale change > 0.12
- Photo attack wrapper: flags if spoofConfidence > 0.50
- Replay attack wrapper: flags if spoofConfidence > 0.60 or moiré detected
- Authentication threshold: ≥ 70/100; Registration threshold: ≥ 80/100

**Security Dashboard**
- Real-time device hardening status: Root · Frida · Magisk · Xposed · APK Integrity · Debugger
- All checks run via native C++ SecurityModule via Nitro bridge
- DEV mode bypass for non-production builds only

**Attendance**
- Offline-first attendance queue using SQLite sync_queue table
- hex(payload) BLOB reading for reliable cross-device SQLite compatibility
- Background sync to AWS when connectivity is restored
- Attendance history with search and filter (All/Present/Absent)

**Database**
- SQLite WAL mode for concurrent read performance
- Schema v2: users, embeddings, sync_queue, audit_logs
- Additive migration system with PRAGMA user_version
- AES-256-CBC encrypted fields: name, employee_id, embedding
- Corruption recovery from encrypted backup (secure_edge_backup.enc)

**APK Optimization**
- arm64-v8a only build (no universal APK)
- ProGuard + R8 shrink: enabled in release
- shrinkResources: enabled
- resConfigs "en" only
- Final APK size: **16.09 MB** (budget: < 19 MB) ✅

#### Bug Fixes

- **Password login** — Fixed race condition where `usersList` was empty on first render; login now calls `getAllUsers()` directly at auth time
- **Face login stale user** — Fixed: face auth now searches ALL users' embeddings and activates the matched user's profile in secureStorage immediately
- **Face re-registration stops** — Fixed: added `UPDATE_FACE_TEMPLATE` mode, added `RegistrationSuccess` to RootNavigator, passes `activeUser` param from Dashboard
- **Attendance empty** — Fixed: replaced raw BLOB read with `hex(payload)` + `hexToUtf8()` conversion; fixed malformed regex in audit log name extraction

#### Architecture

- Nitro Modules C++ bridge for zero-copy worklet model inference
- `useFrameProcessor` worklet pattern for sub-millisecond camera frame processing
- Modular hook architecture: `useDatabase`, `useFaceAuth`, `useLiveness`, `useSecurity`, `useSync`
- AI Skills system (`.ai/`) for repository-level AI agent context preservation

---

## [0.9.0] — 2026-05-29 (Pre-release)

- Enterprise architecture refactor with modular component system
- Premium UI with dark theme design system
- Runtime telemetry and QA logging instrumentation
- E2E device validation pipeline

## [0.8.0] — 2026-05-28

- Extreme APK size optimization (30 MB+ → 16 MB)
- arm64-v8a ABI filter
- ProGuard rules tuning
- Asset compression

## [0.7.0] — 2026-05-27

- Advanced liveness detection integration
- Anti-spoofing pipeline (4-signal composite)
- BlazeFace inference pipeline with NMS
- VisionCamera v4 API migration

## [0.6.0] — 2026-05-20

- Security module integration (Root, Frida, Magisk, Xposed)
- AES-256-CBC encryption layer
- Android Keystore key management
- Audit logging system

## [0.5.0] — 2026-05-15

- SQLite database with WAL mode
- Schema migrations (v1 → v2)
- Embedding repository (encrypted BLOB storage)
- Attendance queue (offline sync)

## [0.4.0] — 2026-05-10

- MobileFaceNet integration (192-dim embeddings)
- Cosine similarity matching
- Face enrollment flow

## [0.3.0] — 2026-05-05

- BlazeFace integration (front + back)
- Frame processor pipeline
- Face quality validation

## [0.2.0] — 2026-04-28

- React Navigation 3-layer stack
- Dashboard with 4-tab layout
- Registration wizard (3 steps)

## [0.1.0] — 2026-04-20

- Project initialization
- React Native 0.85.3 + TypeScript
- Basic camera integration
