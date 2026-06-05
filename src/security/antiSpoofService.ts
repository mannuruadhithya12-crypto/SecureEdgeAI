/**
 * AntiSpoofService — Central orchestrator for all advanced anti-spoofing modules.
 *
 * Coordinates:
 *   1. Face Quality Validation   (blur, lighting, occlusion)
 *   2. Blink Liveness            (EAR-based valley detection)
 *   3. Head Turn Liveness        (yaw-based nose history)
 *   4. Photo Attack Detection    (frozen micro-motion analysis)
 *   5. Replay Attack Detection   (moire / flat-emission analysis)
 *   6. Challenge-Response        (randomized 3-step session)
 *   7. Weighted Score Calculator (0–100 anti-spoof score)
 *
 * Registration threshold : score >= 80
 * Authentication threshold: score >= 70
 */

import { validateFaceQuality, FaceQualityResult } from '../ai/faceQuality';
import { detectBlink, getBlinkConfidence, resetBlinkHistory } from '../liveness/blinkDetection';
import { detectHeadMovement, getHeadMovementConfidence, resetHeadMovementHistory } from '../liveness/headMovement';
import { detectPhotoAttack } from './photoAttackDetection';
import { detectReplayAttack } from './replayDetection';
import { verifyAntiSpoofing, resetAntiSpoofHistory } from './antiSpoofing';
import {
  startChallengeSession,
  reportChallengeResult,
  getCurrentChallenge,
  getChallengeProgress,
  resetChallengeSession,
  getChallengeInstruction,
  ChallengeSession,
  ChallengeType,
} from '../liveness/challengeResponse';
import {
  calculateAntiSpoofScore,
  AntiSpoofScoreResult,
} from './antiSpoofScoreCalculator';

export type Keypoint = { x: number; y: number };
export type NormalizedBox = { xMin: number; yMin: number; xMax: number; yMax: number };

export interface AntiSpoofServiceResult {
  score: AntiSpoofScoreResult;
  qualityResult: FaceQualityResult;
  blinkVerified: boolean;
  headTurnVerified: boolean;
  photoAttackDetected: boolean;
  replayAttackDetected: boolean;
  spoofDetected: boolean;
  spoofConfidence: number;
  challengeSession: ChallengeSession | null;
  challengeInstruction: string;
  passed: boolean;
  statusMessage: string;
}

// ------------------- Service State -------------------
let serviceInitialized = false;

/**
 * Thresholds for passing the anti-spoof check.
 */
export const REGISTRATION_THRESHOLD = 80;
export const AUTHENTICATION_THRESHOLD = 70;

/**
 * Initializes the anti-spoof service and starts a new challenge session.
 * Call this when entering a Face Registration or Face Authentication screen.
 * @param stepCount - Number of challenge steps (default: 3)
 */
export function initAntiSpoofService(stepCount: number = 3): void {
  resetAntiSpoofService();
  startChallengeSession(stepCount);
  serviceInitialized = true;
  console.log('[AntiSpoofService] Initialized with challenge session');
}

/**
 * Resets all state across all sub-modules.
 * Call this on screen unmount or restart.
 */
export function resetAntiSpoofService(): void {
  resetBlinkHistory();
  resetHeadMovementHistory();
  resetAntiSpoofHistory();
  resetChallengeSession();
  serviceInitialized = false;
  console.log('[AntiSpoofService] Reset complete');
}

/**
 * Runs the full anti-spoof pipeline for a single video frame.
 * Call this from the JS thread (NOT from a worklet) after extracting results.
 *
 * @param pixels        - 128×128 blazeface pixel array (float32, RGB)
 * @param width         - Pixel array width (128)
 * @param height        - Pixel array height (128)
 * @param box           - Normalized bounding box from BlazeFace
 * @param keypoints     - Array of 6 keypoints from BlazeFace
 * @param isEmulator    - If true, bypass all sensor-reliant checks
 * @param mode          - 'registration' | 'authentication' — sets threshold
 */
export function runAntiSpoofPipeline(
  pixels: Float32Array,
  width: number,
  height: number,
  box: NormalizedBox,
  keypoints: Keypoint[],
  isEmulator: boolean = false,
  mode: 'registration' | 'authentication' = 'authentication'
): AntiSpoofServiceResult {

  const threshold = mode === 'registration' ? REGISTRATION_THRESHOLD : AUTHENTICATION_THRESHOLD;

  // --- Emulator bypass ---
  if (isEmulator) {
    const bypassScore = calculateAntiSpoofScore({
      faceQualityScore: 1.0,
      blurDetected: false,
      lowLightDetected: false,
      occluded: false,
      blinkVerified: true,
      blinkConfidence: 1.0,
      headTurnVerified: true,
      headMovementConfidence: 1.0,
      photoAttackDetected: false,
      replayAttackDetected: false,
      spoofConfidence: 0.0,
      challengeAllPassed: true,
      challengeProgress: 1.0,
      isEmulator: true,
    }, threshold);

    return {
      score: bypassScore,
      qualityResult: {
        qualityScore: 1.0,
        blurDetected: false,
        lowLightDetected: false,
        occluded: false,
        alignmentInvalid: false,
        tooSmall: false,
      },
      blinkVerified: true,
      headTurnVerified: true,
      photoAttackDetected: false,
      replayAttackDetected: false,
      spoofDetected: false,
      spoofConfidence: 0.0,
      challengeSession: null,
      challengeInstruction: 'Emulator Mode',
      passed: true,
      statusMessage: 'Anti-spoof: Emulator mode bypass',
    };
  }

  // ------ 1. Face Quality ------
  const qualityResult = validateFaceQuality(pixels, width, height, box, keypoints, false);

  // ------ 2. Blink Liveness ------
  const blinkVerified = detectBlink(pixels, keypoints, false);
  const blinkConfidence = getBlinkConfidence();

  // ------ 3. Head Turn Liveness ------
  const headTurnVerified = detectHeadMovement(box, keypoints, false);
  const headMovementConfidence = getHeadMovementConfidence();

  // ------ 4. Anti-Spoof Checks ------
  const spoofRes = verifyAntiSpoofing(pixels, width, height, box, keypoints, false);
  const photoAttackDetected = detectPhotoAttack(pixels, width, height, box, keypoints, false);
  const replayAttackDetected = detectReplayAttack(pixels, width, height, box, keypoints, false);

  // ------ 5. Challenge Response ------
  // Determine if current challenge step has been fulfilled based on detection results
  const currentChallenge = getCurrentChallenge();
  if (currentChallenge != null) {
    let stepPassed = false;
    switch (currentChallenge.type as ChallengeType) {
      case 'BLINK':
        stepPassed = blinkVerified;
        break;
      case 'HEAD_LEFT':
        stepPassed = headTurnVerified;
        break;
      case 'HEAD_RIGHT':
        stepPassed = headTurnVerified;
        break;
      case 'LOOK_UP':
        stepPassed = headTurnVerified;
        break;
      case 'LOOK_DOWN':
        stepPassed = headTurnVerified;
        break;
      case 'SMILE':
        // Smile is harder to detect without a separate model.
        // Approximate via head movement confidence above threshold
        stepPassed = headMovementConfidence > 0.5;
        break;
      default:
        stepPassed = false;
    }
    if (stepPassed) {
      reportChallengeResult(true);
    }
  }

  const challengeProgress = getChallengeProgress();
  const challengeAllPassed = challengeProgress >= 1.0;
  const challengeInstruction = getChallengeInstruction();

  // ------ 6. Score ------
  const scoreResult = calculateAntiSpoofScore({
    faceQualityScore: qualityResult.qualityScore,
    blurDetected: qualityResult.blurDetected,
    lowLightDetected: qualityResult.lowLightDetected,
    occluded: qualityResult.occluded,
    blinkVerified,
    blinkConfidence,
    headTurnVerified,
    headMovementConfidence,
    photoAttackDetected,
    replayAttackDetected,
    spoofConfidence: spoofRes.spoofConfidence,
    challengeAllPassed,
    challengeProgress,
    isEmulator: false,
  }, threshold);

  // ------ 7. Status Message ------
  let statusMessage: string;
  if (photoAttackDetected) {
    statusMessage = 'Anti-spoof: Photo attack detected';
  } else if (replayAttackDetected) {
    statusMessage = 'Anti-spoof: Replay attack detected';
  } else if (!blinkVerified && !headTurnVerified) {
    statusMessage = challengeInstruction;
  } else if (!scoreResult.passed) {
    statusMessage = `Liveness check: ${Math.round(challengeProgress * 100)}% complete`;
  } else {
    statusMessage = `Anti-spoof passed (${scoreResult.totalScore}/100)`;
  }

  console.log(`[AntiSpoofService] Pipeline complete — Score: ${scoreResult.totalScore}, Mode: ${mode}, Passed: ${scoreResult.passed}`);

  return {
    score: scoreResult,
    qualityResult,
    blinkVerified,
    headTurnVerified,
    photoAttackDetected,
    replayAttackDetected,
    spoofDetected: spoofRes.spoofDetected,
    spoofConfidence: spoofRes.spoofConfidence,
    challengeSession: null, // already managed internally
    challengeInstruction,
    passed: scoreResult.passed,
    statusMessage,
  };
}
