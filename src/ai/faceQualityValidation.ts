import { validateFaceQuality, FaceQualityResult, NormalizedBox, Keypoint } from './faceQuality';

export interface ExtendedQualityResult extends FaceQualityResult {
  passed: boolean;
}

export function validateFaceQualityQA(
  pixels: Float32Array,
  width: number,
  height: number,
  box: NormalizedBox,
  keypoints: Keypoint[],
  isEmulator: boolean = false
): ExtendedQualityResult {
  const result = validateFaceQuality(pixels, width, height, box, keypoints, isEmulator);
  
  // Log results to satisfy QA requirements
  if (result.blurDetected) {
    console.log('[QA] BLUR_DETECTED');
  }
  
  if (result.lowLightDetected) {
    console.log('[QA] LOW_LIGHT_DETECTED');
  } else {
    console.log('[QA] LIGHTING_VALID');
  }
  
  if (result.occluded) {
    console.log('[QA] OCCLUSION_DETECTED');
  }
  
  // Overall check
  const passed = result.qualityScore >= 0.65; // Threshold
  if (passed) {
    console.log('[QA] FACE_QUALITY_PASSED');
  }
  
  return {
    ...result,
    passed,
  };
}
