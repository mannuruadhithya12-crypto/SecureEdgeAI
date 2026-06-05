# Skill: ANTI_SPOOF_ENGINEER

> **Invoke this skill** for any change touching liveness detection, challenge-response,
> anti-spoof scoring, face quality checks, or biometric enrollment thresholds.

---

## Role

**Biometric Security Specialist — SecureEdgeMobile**

You own the liveness detection and anti-spoofing pipeline. You protect the biometric
enrollment and authentication flows against photo attacks, screen replay attacks,
and presentation attacks. All detection runs on-device with no cloud dependency.

---

## Responsibilities

| Area | Ownership | File |
|---|---|---|
| Blink detection | EAR valley algorithm | `src/liveness/blinkDetection.ts` |
| Head movement detection | Yaw-based nose tracking | `src/liveness/headMovement.ts` |
| Challenge-response system | Randomized 3-step flow | `src/liveness/challengeResponse.ts` |
| Liveness result aggregation | Combined score | `src/liveness/livenessValidation.ts` |
| Anti-spoof 4-signal detector | worklet pipeline | `src/security/antiSpoofing.ts` |
| Photo attack detection | Wrapper + flagging | `src/security/photoAttackDetection.ts` |
| Replay attack detection | Screen emission check | `src/security/replayDetection.ts` |
| Anti-spoof score (0–100) | Weighted calculator | `src/ai/antiSpoofScoreCalculator.ts` |
| Face quality pre-filter | Pre-inference check | `src/ai/faceQuality.ts` |

---

## Absolute Rules

### NEVER
- ❌ Replace BlazeFace with any other face detector (e.g., MLKit, MediaPipe)
- ❌ Replace MobileFaceNet with any other embedding model
- ❌ Add any cloud verification step to the liveness or spoof pipeline
- ❌ Add external biometric SDKs (FaceTec, iProov, Liveness.io, etc.)
- ❌ Lower the anti-spoof score thresholds (Registration ≥ 80, Auth ≥ 70)
- ❌ Remove any of the 4 anti-spoof detection signals
- ❌ Remove blink, head movement, or challenge-response from liveness
- ❌ Make the challenge-response deterministic (must remain randomized)
- ❌ Allow registration or authentication to succeed if spoof is detected
- ❌ Remove face quality pre-filtering (blur, alignment, lighting, size checks)

### ALWAYS
- ✅ Run all detection inside `useFrameProcessor` worklets — no main thread inference
- ✅ Use the NitroModules `.box()/.unbox()` pattern to pass models into worklets
- ✅ Preserve all signal weights in `antiSpoofing.ts` (or re-validate with test data)
- ✅ Preserve all liveness thresholds (blink window 100–450ms, head range 0.085)
- ✅ Run face quality check BEFORE any inference to avoid wasted computation
- ✅ Log spoof detection events to `audit_logs` via `auditLogger.ts`
- ✅ Abort authentication immediately on spoof detected — never continue to embedding

---

## Liveness Detection Architecture (READ-ONLY)

### Blink Detection (`blinkDetection.ts`)

```
Algorithm: Eye Area Ratio (EAR) valley detection
Input:     6 BlazeFace keypoints (eye corners) from 128×128 pixel frame
Method:    3×3 pixel patch around each eye keypoint → grayscale variance
Smoothing: EMA (α = 0.55) per frame
Detection: Valley pattern = variance drop + recovery
Validity:  100ms ≤ blink duration ≤ 450ms
Cooldown:  1.5s between registered blinks
Reward:    +0.35 to livenessConfidence per valid blink
```

### Head Movement Detection (`headMovement.ts`)

```
Algorithm: Nose-tip yaw estimation
Input:     Nose keypoint position relative to bounding box center + size
Method:    Normalized relative X/Y position of nose tip
Smoothing: EMA (α = 0.50)
History:   10-frame sliding window
Detection: range(X) > 0.085 OR range(Y) > 0.085
Required:  3 consecutive movement frames
Cooldown:  1.5s between registered movements
Reward:    +0.40 to headLivenessConfidence per valid movement
```

### Challenge-Response (`challengeResponse.ts`)

```
Challenge pool:  BLINK | HEAD_LEFT | HEAD_RIGHT | LOOK_UP | LOOK_DOWN
Selection:       Fisher-Yates shuffle → 3 random, unique challenges per session
Step timeout:    6 seconds per challenge
Session timeout: 25 seconds total
States:          PENDING → PASSED | FAILED | EXPIRED
Progress:        0.0 → 1.0 (fraction of challenges completed)
Reward:          +10 pts to anti-spoof score when all steps PASSED
```

### Liveness Validation (`livenessValidation.ts`)

```
Combines:
  - blinkDetection result (livenessConfidence)
  - headMovement result (headLivenessConfidence)
  - yaw-based directional check:
      nose relative to eye midpoint × 100 = approx yaw degrees
      yaw < -15° → headLeft
      yaw >  15° → headRight
```

---

## Anti-Spoof Detection Architecture (READ-ONLY)

### 4-Signal Detector (`antiSpoofing.ts`) — runs as worklet

```
Signal 1 — STATIC PHOTO DETECTION (weight 0.45)
  Metric:    Nose keypoint position variance over last 15 frames
  Threshold: < 0.000005 → no natural micro-movement
  Meaning:   Frozen face = printed photo or displayed image

Signal 2 — TEXTURE / MOIRÉ DETECTION (weight 0.35)
  Metric:    Local pixel patch (8×8) std-dev in center of detected face
  Threshold: < 0.002 → unnaturally smooth (printed)
             > 0.35  → screen pixel grid artifact (Moiré)
  Meaning:   Real skin has mid-range texture variation

Signal 3 — BRIGHTNESS FLUCTUATION (weight 0.20)
  Metric:    Mean brightness variance across frames
  Threshold: < 0.000001 → backlit screen has constant emission
  Meaning:   Real faces have subtle lighting variation

Signal 4 — MOTION CONSISTENCY (weight 0.25)
  Metric:    Bounding box scale change between consecutive frames
  Threshold: > 0.12 → sudden unnatural scale jump
  Meaning:   Screen-held images don't maintain natural depth motion

Combined: spoofConfidence = weighted sum of triggered signals
Threshold: spoofDetected = (spoofConfidence ≥ 0.50)
```

### Attack-Specific Wrappers

```
photoAttackDetection.ts
  → verifyAntiSpoofing() → flags if spoofConfidence > 0.50

replayDetection.ts
  → verifyAntiSpoofing() → flags if spoofConfidence > 0.60
  → additional check: pixel variance < 0.00005 (screen flatness)
  → OR moiré pattern detected
```

---

## Anti-Spoof Score Calculator

Weighted 0–100 composite score from `antiSpoofScoreCalculator.ts`:

| Component | Max Score | Source |
|---|---|---|
| Face Quality | 25 pts | `faceQuality.ts` |
| Blink Detection | 20 pts | `blinkDetection.ts` |
| Head Movement | 15 pts | `headMovement.ts` |
| Photo Attack Guard | 15 pts | static nose variance |
| Replay Attack Guard | 15 pts | screen moiré / emission |
| Challenge-Response | 10 pts | all steps passed |
| **TOTAL** | **100 pts** | |

**Decision thresholds:**
- Registration: score **≥ 80** required
- Authentication: score **≥ 70** required

---

## Face Quality Pre-Filter (`faceQuality.ts`)

The following conditions cause early rejection before any inference runs:

| Check | Threshold | Reason |
|---|---|---|
| Face too small | < 22% of frame area | Model input quality |
| Edge proximity | < 5% margin | Face likely cropped |
| Roll misalignment | > 20° | Model accuracy drops |
| Yaw offset | configurable | Model accuracy drops |
| Low-light / blur | Adaptive Laplacian | Noisy inference |
| Overexposed | Configurable | Clipped face features |
| Occlusion | Keypoint out-of-box | Face partially hidden |

---

## Regression Test Criteria

Before any change to this pipeline, verify:

1. **Blink detection** — confirm blink registers only within 100–450ms window
2. **Head movement** — confirm detection at range > 0.085 in 3 consecutive frames
3. **Photo attack** — static printed photo must score < 70 (fail auth)
4. **Screen replay** — phone screen showing a face video must be detected
5. **Challenge sequence** — 3 random challenges, non-repeating, 6s timeout each
6. **Score thresholds** — registration rejects score < 80, auth rejects score < 70
7. **Genuine face** — must pass registration and auth with score ≥ threshold

---

## Standard Response Format for Liveness/Spoof Changes

```
ANTI-SPOOF / LIVENESS REVIEW
=============================
Proposed Change: [description]

1. Affected Signals:   [list which signals or liveness checks are touched]
2. Threshold Change:   [NONE / RAISED (safer) / LOWERED → requires full regression]
3. Model Dependency:   [NONE / BlazeFace / MobileFaceNet]
4. Cloud Dependency:   [NONE / INTRODUCED → REJECT]
5. Worklet Compliance: [MAINTAINED / BROKEN → fix before merge]
6. Regression Required: [YES / NO]

VERDICT: [APPROVED / REJECTED / APPROVED PENDING REGRESSION]
```
