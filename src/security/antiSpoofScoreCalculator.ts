/**
 * Anti-Spoof Score Calculator
 * 
 * Weighted scoring model to produce a final 0–100 anti-spoofing score.
 * 
 * Score components (total 100 points):
 *   - Face Quality          : 25 pts  (blur, lighting, occlusion, size)
 *   - Liveness Blink        : 20 pts  (verified EAR valley detection)
 *   - Liveness Head Turn    : 15 pts  (yaw-based head movement)
 *   - Photo Attack Guard    : 15 pts  (no frozen micro-motion)
 *   - Replay Attack Guard   : 15 pts  (no screen moire or flat emission)
 *   - Challenge Response    : 10 pts  (randomized steps all passed)
 *
 * Thresholds:
 *   - Registration: score >= 80 required
 *   - Authentication: score >= 70 required
 */

export interface AntiSpoofInputs {
  // Quality component
  faceQualityScore: number;       // 0.0 to 1.0 (from validateFaceQuality)
  blurDetected: boolean;
  lowLightDetected: boolean;
  occluded: boolean;

  // Liveness components
  blinkVerified: boolean;
  blinkConfidence: number;        // 0.0 to 1.0 (from getBlinkConfidence)
  headTurnVerified: boolean;      // blink OR head moved
  headMovementConfidence: number; // 0.0 to 1.0 (from getHeadMovementConfidence)

  // Spoof guards
  photoAttackDetected: boolean;
  replayAttackDetected: boolean;
  spoofConfidence: number;        // 0.0 to 1.0 (from verifyAntiSpoofing)

  // Challenge response
  challengeAllPassed: boolean;
  challengeProgress: number;      // 0.0 to 1.0

  // Mode override
  isEmulator: boolean;
}

export interface AntiSpoofScoreResult {
  totalScore: number;            // 0 to 100
  qualityPoints: number;         // 0 to 25
  blinkPoints: number;           // 0 to 20
  headTurnPoints: number;        // 0 to 15
  photoGuardPoints: number;      // 0 to 15
  replayGuardPoints: number;     // 0 to 15
  challengePoints: number;       // 0 to 10
  passed: boolean;               // score >= threshold
  threshold: number;
  details: string[];
}

/**
 * Calculates the weighted anti-spoof score.
 * @param inputs - Inputs from all detection modules
 * @param threshold - Minimum passing score (80 for registration, 70 for auth)
 */
export function calculateAntiSpoofScore(
  inputs: AntiSpoofInputs,
  threshold: number = 70
): AntiSpoofScoreResult {
  const details: string[] = [];

  // ---- Emulator bypass ----
  if (inputs.isEmulator) {
    console.log('[AntiSpoofScore] EMULATOR_MODE — Full bypass. Score=100');
    return {
      totalScore: 100,
      qualityPoints: 25,
      blinkPoints: 20,
      headTurnPoints: 15,
      photoGuardPoints: 15,
      replayGuardPoints: 15,
      challengePoints: 10,
      passed: true,
      threshold,
      details: ['EMULATOR_BYPASS'],
    };
  }

  // ---- 1. Face Quality (25 pts) ----
  let qualityPoints = 0;
  {
    // Base quality proportional to score
    const base = Math.max(0.0, inputs.faceQualityScore) * 25;

    // Hard penalties for failures
    let penalty = 0;
    if (inputs.blurDetected) {
      penalty += 8;
      details.push('BLUR_PENALTY(-8)');
    }
    if (inputs.lowLightDetected) {
      penalty += 6;
      details.push('LOW_LIGHT_PENALTY(-6)');
    }
    if (inputs.occluded) {
      penalty += 10;
      details.push('OCCLUSION_PENALTY(-10)');
    }

    qualityPoints = Math.max(0, Math.min(25, Math.round(base - penalty)));
  }
  details.push(`QUALITY_PTS=${qualityPoints}`);

  // ---- 2. Liveness Blink (20 pts) ----
  let blinkPoints = 0;
  {
    if (inputs.blinkVerified) {
      // Scale by blink confidence
      blinkPoints = Math.round(10 + inputs.blinkConfidence * 10);
      blinkPoints = Math.min(20, blinkPoints);
      details.push('BLINK_VERIFIED');
    } else {
      // Partial credit for rising confidence
      blinkPoints = Math.round(inputs.blinkConfidence * 8);
      details.push(`BLINK_PARTIAL=${blinkPoints}`);
    }
  }
  details.push(`BLINK_PTS=${blinkPoints}`);

  // ---- 3. Head Turn Liveness (15 pts) ----
  let headTurnPoints = 0;
  {
    if (inputs.headTurnVerified) {
      headTurnPoints = Math.round(8 + inputs.headMovementConfidence * 7);
      headTurnPoints = Math.min(15, headTurnPoints);
      details.push('HEAD_TURN_VERIFIED');
    } else {
      headTurnPoints = Math.round(inputs.headMovementConfidence * 6);
      details.push(`HEAD_PARTIAL=${headTurnPoints}`);
    }
  }
  details.push(`HEAD_PTS=${headTurnPoints}`);

  // ---- 4. Photo Attack Guard (15 pts) ----
  let photoGuardPoints = 0;
  {
    if (inputs.photoAttackDetected) {
      photoGuardPoints = 0;
      details.push('PHOTO_ATTACK_DETECTED');
    } else {
      // Full points when spoof confidence is low, sliding scale
      const spoofPenalty = Math.round(inputs.spoofConfidence * 10);
      photoGuardPoints = Math.max(0, 15 - spoofPenalty);
    }
  }
  details.push(`PHOTO_PTS=${photoGuardPoints}`);

  // ---- 5. Replay Attack Guard (15 pts) ----
  let replayGuardPoints = 0;
  {
    if (inputs.replayAttackDetected) {
      replayGuardPoints = 0;
      details.push('REPLAY_ATTACK_DETECTED');
    } else {
      const spoofPenalty = Math.round(inputs.spoofConfidence * 8);
      replayGuardPoints = Math.max(0, 15 - spoofPenalty);
    }
  }
  details.push(`REPLAY_PTS=${replayGuardPoints}`);

  // ---- 6. Challenge Response (10 pts) ----
  let challengePoints = 0;
  {
    if (inputs.challengeAllPassed) {
      challengePoints = 10;
      details.push('CHALLENGE_ALL_PASSED');
    } else {
      challengePoints = Math.round(inputs.challengeProgress * 10);
      details.push(`CHALLENGE_PARTIAL=${challengePoints}`);
    }
  }
  details.push(`CHALLENGE_PTS=${challengePoints}`);

  // ---- Total ----
  const totalScore = qualityPoints + blinkPoints + headTurnPoints + photoGuardPoints + replayGuardPoints + challengePoints;
  const passed = totalScore >= threshold;

  console.log(`[AntiSpoofScore] Total=${totalScore}/100 | Threshold=${threshold} | Passed=${passed}`);
  console.log(`[AntiSpoofScore] Q=${qualityPoints} BL=${blinkPoints} HD=${headTurnPoints} PH=${photoGuardPoints} RP=${replayGuardPoints} CH=${challengePoints}`);

  return {
    totalScore: Math.min(100, totalScore),
    qualityPoints,
    blinkPoints,
    headTurnPoints,
    photoGuardPoints,
    replayGuardPoints,
    challengePoints,
    passed,
    threshold,
    details,
  };
}
