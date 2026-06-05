# Anti-Spoofing & Liveness — SecureEdgeMobile

## Overview

SecureEdgeMobile uses a multi-layered, fully on-device anti-spoofing system.
No cloud ML API. No external SDK. All signals computed from the 128×128 BlazeFace
pixel buffer and keypoints in real time.

---

## Anti-Spoof Score System (0–100)

| Component | Max Score | Source File |
|---|---|---|
| Face Quality | 25 pts | `src/ai/faceQuality.ts` |
| Blink Detection | 20 pts | `src/liveness/blinkDetection.ts` |
| Head Movement | 15 pts | `src/liveness/headMovement.ts` |
| Photo Attack Guard | 15 pts | nose keypoint variance |
| Replay Attack Guard | 15 pts | screen moiré / brightness |
| Challenge-Response | 10 pts | `src/liveness/challengeResponse.ts` |

**Decision thresholds:**
- Registration: score **≥ 80** required
- Authentication: score **≥ 70** required

---

## Signal 1 — Static Photo Detection (weight 0.45)

**Principle:** Real faces exhibit constant micro-movement. A printed photo or held screen is static.

```
Metric:    nose keypoint X/Y variance over last 15 frames
Threshold: variance < 0.000005 → frozen face → spoof
```

This is the highest-weight signal because photos/screens with no movement are the
most common attack vector and the most reliably detected.

---

## Signal 2 — Texture / Moiré Detection (weight 0.35)

**Principle:** Screen pixels and printed paper have abnormal texture statistics.

```
Metric:    local 8×8 pixel patch std-deviation at face center
Threshold: std-dev < 0.002 → unnaturally smooth (printed photo)
           std-dev > 0.35  → screen pixel grid artifact (Moiré pattern)
```

Real skin has mid-range texture variance. Both extremes indicate a spoof.

---

## Signal 3 — Brightness Fluctuation Detection (weight 0.20)

**Principle:** Screen backlights emit constant brightness. Real faces under natural or
artificial light have subtle brightness variance from breathing, micro-movements, and
ambient light fluctuation.

```
Metric:    mean brightness variance across frames
Threshold: variance < 0.000001 → flat screen emission → spoof
```

---

## Signal 4 — Motion Consistency Detection (weight 0.25)

**Principle:** Real faces maintain consistent depth and scale during movement. A photo
or screen held by a hand has unnatural scale jumps.

```
Metric:    bounding box scale change between consecutive frames
           scale = (xMax - xMin) * (yMax - yMin)
Threshold: abs(scale_change) > 0.12 → unnatural distortion → spoof
```

---

## Combined Score Calculation

```typescript
spoofConfidence =
  (signal1_triggered ? 0.45 : 0) +
  (signal2_triggered ? 0.35 : 0) +
  (signal3_triggered ? 0.20 : 0) +
  (signal4_triggered ? 0.25 : 0);

spoofDetected = spoofConfidence >= 0.50;
```

Note: weights sum > 1.0 intentionally — multiple simultaneous signals push confidence
higher to create clear separation between genuine and spoof cases.

---

## Attack-Specific Wrappers

### Photo Attack (`src/security/photoAttackDetection.ts`)
- Wraps `verifyAntiSpoofing()`
- Flags if `spoofConfidence > 0.50`
- Logs `PHOTO_ATTACK_DETECTED` to audit trail

### Replay Attack (`src/security/replayDetection.ts`)
- Wraps `verifyAntiSpoofing()`
- Stricter threshold: `spoofConfidence > 0.60`
- Additional check: pixel variance < 0.00005 (screen flatness)
- Flags on moiré detection alone (regardless of confidence)
- Logs `REPLAY_ATTACK_DETECTED` to audit trail

---

## Liveness Detection

### Blink Detection (`src/liveness/blinkDetection.ts`)

```
Input:     6 BlazeFace keypoints (eye corners) + 128×128 pixel frame
Method:    Extract 3×3 pixel patch around each eye keypoint
           Compute grayscale variance per eye patch per frame
           Apply EMA smoothing (α = 0.55)
Detection: Valley pattern = variance drop + recovery
Validity:  100ms ≤ blink duration ≤ 450ms
Cooldown:  1.5 seconds between registered blinks
Reward:    +0.35 to livenessConfidence
```

**Why the timing window matters:**
- < 100ms: too fast to be a natural blink (could be noise)
- > 450ms: too slow (could be a recorded video pausing)
- 100–450ms: natural human blink range

### Head Movement Detection (`src/liveness/headMovement.ts`)

```
Input:     Nose keypoint position + bounding box
Method:    Normalize nose tip X/Y relative to bbox center and size
           Apply EMA smoothing (α = 0.50)
           Maintain 10-frame sliding window
Detection: max(X_range) > 0.085 OR max(Y_range) > 0.085
Validity:  3 consecutive movement frames required
Cooldown:  1.5 seconds between registered movements
Reward:    +0.40 to headLivenessConfidence
```

### Challenge-Response (`src/liveness/challengeResponse.ts`)

```
Challenge pool: BLINK | HEAD_LEFT | HEAD_RIGHT | LOOK_UP | LOOK_DOWN
Selection:      Fisher-Yates shuffle → 3 unique random steps
Per-step limit: 6 seconds
Session limit:  25 seconds total
States:         PENDING → PASSED | FAILED | EXPIRED
Progress:       0.0 → 1.0 (fraction completed)
Reward:         +10 pts to anti-spoof score on full completion
```

Challenge sequence is **non-deterministic** — prevents replay of pre-recorded
compliant sequences.

---

## Face Quality Pre-Filter (`src/ai/faceQuality.ts`)

Face quality is checked before any inference to reject low-quality input early:

| Check | Threshold | Error Message |
|---|---|---|
| Face too small | < 22% of frame area | "Face too small. Move closer." |
| Edge proximity | < 5% margin from frame edge | "Center your face in the guide." |
| Roll misalignment | > 20° rotation | "Face alignment invalid" |
| Low-light / blur | Adaptive Laplacian threshold | "Face too dark / too blurry" |
| Overexposure | Mean brightness > threshold | "Reduce bright background." |
| Occlusion | Keypoint out of bounding box | "Remove mask / face covering." |

---

## Regression Test Criteria

After any change to this pipeline, verify all of:

| Test | Expected |
|---|---|
| Genuine face, adequate lighting | Score ≥ 80 (registration), ≥ 70 (auth) |
| Printed A4 photo | spoofConfidence ≥ 0.50, auth rejected |
| Phone screen showing face video | replayDetection flags, auth rejected |
| Blink within 100–450ms | Blink registered, liveness +0.35 |
| Blink < 100ms | NOT registered |
| Head turn range > 0.085 | Head movement registered |
| Challenge: wrong order | Steps fail, session expires |
| Low-light face | Quality rejection before inference |
