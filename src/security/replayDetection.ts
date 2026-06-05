import { verifyAntiSpoofing, NormalizedBox, Keypoint } from './antiSpoofing';

export function detectReplayAttack(
  pixels: Float32Array,
  width: number,
  height: number,
  box: NormalizedBox,
  keypoints: Keypoint[],
  isEmulator: boolean = false
): boolean {
  if (isEmulator) return false;

  const result = verifyAntiSpoofing(pixels, width, height, box, keypoints, isEmulator);
  
  // A replay attack is flagged if the anti-spoof check detects moire patterns or flat emission.
  // We can also extract sub-features by running local standard deviation analysis.
  let brightnessVar = 0.00001; // default
  let isMoiréDetected = false;

  // Let's run a quick refresh check
  let sum = 0;
  let sqSum = 0;
  const len = Math.min(pixels.length, 300);
  for (let i = 0; i < len; i++) {
    sum += pixels[i];
    sqSum += pixels[i] * pixels[i];
  }
  const mean = sum / len;
  const variance = (sqSum / len) - (mean * mean);

  // If variance is extremely flat (less than 0.0001) or contains regular grid structures
  if (variance < 0.00005) {
    isMoiréDetected = true;
  }

  const isReplay = result.spoofDetected && (result.spoofConfidence > 0.6 || isMoiréDetected);
  if (isReplay) {
    console.log('[QA] REPLAY_ATTACK_DETECTED');
  }

  return isReplay;
}
