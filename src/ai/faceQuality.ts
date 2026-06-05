export type Keypoint = {
  x: number;
  y: number;
};

export type NormalizedBox = {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
};

export interface FaceQualityResult {
  qualityScore: number;
  blurDetected: boolean;
  lowLightDetected: boolean;
  occluded: boolean;
  alignmentInvalid: boolean;
  tooSmall: boolean;
}

/**
 * Validates face quality and outputs structured metrics.
 * Dynamically relaxes thresholds in low-light environments.
 */
export function validateFaceQuality(
  pixels: Float32Array,
  width: number,
  height: number,
  box: NormalizedBox,
  keypoints: Keypoint[],
  isEmulator: boolean = false
): FaceQualityResult {
  'worklet';
  
  // 1. Enforce Box Proximity / Edge Proximity check
  const margin = 0.05;
  const isEdgeViolated = (
    box.xMin < margin ||
    box.yMin < margin ||
    box.xMax > (1 - margin) ||
    box.yMax > (1 - margin)
  );

  // 2. Face size validation
  const faceWidth = box.xMax - box.xMin;
  const faceHeight = box.yMax - box.yMin;
  const tooSmall = faceWidth < 0.22 || faceHeight < 0.22;

  // 3. Occlusion & alignment check (checking landmarks)
  let occluded = false;
  let alignmentInvalid = false;

  if (keypoints == null || keypoints.length < 6) {
    occluded = true;
  } else {
    // Check if keypoints are out of logical box boundaries
    for (let i = 0; i < keypoints.length; i++) {
      const kp = keypoints[i];
      if (kp.x < box.xMin || kp.x > box.xMax || kp.y < box.yMin || kp.y > box.yMax) {
        // Highly likely occluded or tracking glitch
        occluded = true;
        break;
      }
    }

    if (!occluded) {
      const rightEye = keypoints[0];
      const leftEye = keypoints[1];
      const nose = keypoints[2];
      
      // Roll alignment
      const dy = leftEye.y - rightEye.y;
      const dx = leftEye.x - rightEye.x;
      const rollAngle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
      const maxRoll = isEmulator ? 30.0 : 20.0;
      if (rollAngle > maxRoll && rollAngle < (180 - maxRoll)) {
        alignmentInvalid = true;
      }
      
      // Yaw centering: nose relative to eyes mid-point
      const eyesMidX = (leftEye.x + rightEye.x) / 2;
      const eyeDist = Math.sqrt(dx * dx + dy * dy);
      if (eyeDist === 0) {
        alignmentInvalid = true;
      } else {
        const noseOffsetX = Math.abs(nose.x - eyesMidX);
        const maxOffsetYaw = isEmulator ? 0.45 : 0.35;
        if (noseOffsetX / eyeDist > maxOffsetYaw) {
          alignmentInvalid = true;
        }
      }
    }
  }

  // 4. Ambient brightness (low light and overexposure check)
  let sum = 0;
  const length = width * height;
  let isRange255 = false;
  
  // Quick range scan
  const scanLen = Math.min(pixels.length, 100);
  for (let k = 0; k < scanLen; k++) {
    if (pixels[k] > 1.0) {
      isRange255 = true;
      break;
    }
  }

  for (let i = 0; i < length; i++) {
    const idx = i * 3;
    sum += 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
  }
  
  const avgBrightness = sum / length;
  const lowLightThreshold = isRange255 ? 45.0 : 0.18;
  const finalLowLightThreshold = isEmulator ? lowLightThreshold * 0.70 : lowLightThreshold;
  
  const lowLightDetected = avgBrightness < finalLowLightThreshold;
  
  // Overexposure Check: pixel saturation
  const overexposureThreshold = isRange255 ? 235.0 : 0.92;
  const overexposed = avgBrightness > overexposureThreshold;

  // 5. Blur detection (Laplacian variance)
  // Low-Light Adaptive Thresholding: Relax blur thresholds dynamically in dark scenes
  let sumLap = 0;
  let sqSumLap = 0;
  let countLap = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idxC = (y * width + x) * 3;
      const grayC = 0.299 * pixels[idxC] + 0.587 * pixels[idxC + 1] + 0.114 * pixels[idxC + 2];
      
      const idxL = (y * width + (x - 1)) * 3;
      const grayL = 0.299 * pixels[idxL] + 0.587 * pixels[idxL + 1] + 0.114 * pixels[idxL + 2];
      
      const idxR = (y * width + (x + 1)) * 3;
      const grayR = 0.299 * pixels[idxR] + 0.587 * pixels[idxR + 1] + 0.114 * pixels[idxR + 2];
      
      const idxT = ((y - 1) * width + x) * 3;
      const grayT = 0.299 * pixels[idxT] + 0.587 * pixels[idxT + 1] + 0.114 * pixels[idxT + 2];
      
      const idxB = ((y + 1) * width + x) * 3;
      const grayB = 0.299 * pixels[idxB] + 0.587 * pixels[idxB + 1] + 0.114 * pixels[idxB + 2];
      
      const lap = 4 * grayC - grayL - grayR - grayT - grayB;
      sumLap += lap;
      sqSumLap += lap * lap;
      countLap++;
    }
  }
  
  let blurDetected = false;
  if (countLap > 0) {
    const meanLap = sumLap / countLap;
    const varianceLap = (sqSumLap / countLap) - (meanLap * meanLap);
    
    let blurThreshold = isRange255 ? 5.0 : 0.00008;
    if (lowLightDetected) {
      // Relax blur threshold by 35% in low light scenes to prevent aggressive rejection
      blurThreshold = blurThreshold * 0.65;
    }
    const finalBlurThreshold = isEmulator ? blurThreshold * 0.40 : blurThreshold;
    blurDetected = varianceLap < finalBlurThreshold;
  }

  // Calculate overall quality score (0.0 to 1.0)
  let qualityScore = 1.0;
  if (tooSmall) qualityScore -= 0.3;
  if (isEdgeViolated) qualityScore -= 0.15;
  if (alignmentInvalid) qualityScore -= 0.2;
  if (occluded) qualityScore -= 0.4;
  if (lowLightDetected) qualityScore -= 0.25;
  if (overexposed) qualityScore -= 0.2;
  if (blurDetected) qualityScore -= 0.35;
  
  qualityScore = Math.max(0.0, Math.min(1.0, qualityScore));

  // Log distance valid when face is at correct proximity
  if (!tooSmall && !isEmulator) {
    console.log('[QA] DISTANCE_VALID');
  }

  return {
    qualityScore,
    blurDetected,
    lowLightDetected: lowLightDetected || overexposed,
    occluded: occluded || isEdgeViolated,
    alignmentInvalid,
    tooSmall
  };
}
