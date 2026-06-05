import { verifyAntiSpoofing, NormalizedBox, Keypoint } from './antiSpoofing';

export function detectPhotoAttack(
  pixels: Float32Array,
  width: number,
  height: number,
  box: NormalizedBox,
  keypoints: Keypoint[],
  isEmulator: boolean = false
): boolean {
  if (isEmulator) return false;

  const result = verifyAntiSpoofing(pixels, width, height, box, keypoints, isEmulator);
  
  // Printed photo attacks lack nose micro-motion and depth variation
  const isPhoto = result.spoofDetected && result.spoofConfidence > 0.5;
  
  if (isPhoto) {
    console.log('[QA] PHOTO_ATTACK_DETECTED');
  }

  return isPhoto;
}
