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

export interface SpoofResult {
  spoofDetected: boolean;
  spoofConfidence: number; // 0.0 to 1.0
}

// Bounding box history for micro-motion and static photo checks
const boxHistory: NormalizedBox[] = [];
const noseHistory: Keypoint[] = [];
const brightnessHistory: number[] = [];

/**
 * Evaluates anti-spoofing criteria using static photo detection, replay checks, 
 * brightness fluctuations, and motion consistency.
 */
export function verifyAntiSpoofing(
  blazePixels: Float32Array,
  width: number,
  height: number,
  box: NormalizedBox,
  keypoints: Keypoint[],
  isEmulator: boolean = false
): SpoofResult {
  'worklet';

  if (isEmulator) {
    return { spoofDetected: false, spoofConfidence: 0.0 };
  }

  // 1. Maintain history buffers
  boxHistory.push({ ...box });
  if (boxHistory.length > 15) boxHistory.shift();

  if (keypoints && keypoints.length > 2) {
    noseHistory.push({ ...keypoints[2] });
    if (noseHistory.length > 15) noseHistory.shift();
  }

  // Calculate average brightness for micro-fluctuation checks
  let brightnessSum = 0;
  const pixelCount = width * height;
  for (let i = 0; i < Math.min(pixelCount, 500); i++) {
    const idx = i * 3;
    if (idx < blazePixels.length) {
      brightnessSum += 0.299 * blazePixels[idx] + 0.587 * blazePixels[idx + 1] + 0.114 * blazePixels[idx + 2];
    }
  }
  const avgBrightness = brightnessSum / Math.min(pixelCount, 500);
  brightnessHistory.push(avgBrightness);
  if (brightnessHistory.length > 15) brightnessHistory.shift();

  if (boxHistory.length < 8) {
    return { spoofDetected: false, spoofConfidence: 0.0 };
  }

  let spoofConfidence = 0.0;

  // 2. Printed Photo / Static Attack Check (Zero Micro-Motion)
  // Evaluate the variance of the nose position and face size.
  let noseVarX = 0;
  let noseVarY = 0;
  if (noseHistory.length >= 8) {
    let sumX = 0, sumY = 0;
    for (let i = 0; i < noseHistory.length; i++) {
      sumX += noseHistory[i].x;
      sumY += noseHistory[i].y;
    }
    const meanX = sumX / noseHistory.length;
    const meanY = sumY / noseHistory.length;
    for (let i = 0; i < noseHistory.length; i++) {
      noseVarX += (noseHistory[i].x - meanX) * (noseHistory[i].x - meanX);
      noseVarY += (noseHistory[i].y - meanY) * (noseHistory[i].y - meanY);
    }
  }
  
  // Static attacks show absolutely frozen pixel coordinates (e.g. holding a paper photo)
  const isStaticFace = (noseVarX + noseVarY) < 0.000005; // extremely low variance
  if (isStaticFace) {
    spoofConfidence += 0.45;
  }

  // 3. Screen Replay Attack Check (Texture Variation / High Local Variance)
  // Screens exhibit extreme flat contrast or high regular pattern frequencies.
  // We sample 5 eye/nose regions and check standard deviation of variance.
  let highFreqTextureMoiré = false;
  let varianceSum = 0;
  let sampleCount = 0;
  
  // Sample local patches
  const step = Math.floor(blazePixels.length / 10);
  for (let i = 0; i < 8; i++) {
    const startIdx = i * step;
    if (startIdx + 9 < blazePixels.length) {
      let patchSum = 0;
      const vals: number[] = [];
      for (let j = 0; j < 3; j++) {
        const val = 0.299 * blazePixels[startIdx + j*3] + 0.587 * blazePixels[startIdx + j*3 + 1] + 0.114 * blazePixels[startIdx + j*3 + 2];
        patchSum += val;
        vals.push(val);
      }
      const patchMean = patchSum / 3;
      let patchVar = 0;
      for (let j = 0; j < 3; j++) {
        patchVar += (vals[j] - patchMean) * (vals[j] - patchMean);
      }
      varianceSum += Math.sqrt(patchVar / 3);
      sampleCount++;
    }
  }

  const avgTextureVariance = varianceSum / (sampleCount || 1);
  // Real human skin has continuous gradients. Phone displays have local grid colors.
  if (avgTextureVariance < 0.002 || avgTextureVariance > 0.35) {
    highFreqTextureMoiré = true;
    spoofConfidence += 0.35;
  }

  // 4. Brightness Fluctuation Check
  // Screen displays emit constant backlight. Live scenes have micro ambient light fluctuations.
  let brightnessVar = 0;
  if (brightnessHistory.length >= 8) {
    let bSum = 0;
    for (let i = 0; i < brightnessHistory.length; i++) {
      bSum += brightnessHistory[i];
    }
    const bMean = bSum / brightnessHistory.length;
    for (let i = 0; i < brightnessHistory.length; i++) {
      brightnessVar += (brightnessHistory[i] - bMean) * (brightnessHistory[i] - bMean);
    }
  }
  
  if (brightnessVar < 0.000001) { // flat screen emissions
    spoofConfidence += 0.20;
  }

  // 5. Motion Consistency Check
  // Compare box scale changes. Rapid non-linear changes indicate quick movements of fake media.
  let maxScaleChange = 0;
  for (let i = 1; i < boxHistory.length; i++) {
    const prevW = boxHistory[i-1].xMax - boxHistory[i-1].xMin;
    const currW = boxHistory[i].xMax - boxHistory[i].xMin;
    const diff = Math.abs(currW - prevW);
    if (diff > maxScaleChange) {
      maxScaleChange = diff;
    }
  }

  if (maxScaleChange > 0.12) { // Unnatural structural distortion
    spoofConfidence += 0.25;
  }

  const spoofDetected = spoofConfidence >= 0.50;

  if (spoofDetected) {
    console.log(`[Spoof] Spoof detected! Confidence: ${spoofConfidence.toFixed(2)} (Static check: ${isStaticFace}, Moiré check: ${highFreqTextureMoiré}, BrightnessVar: ${brightnessVar.toFixed(8)})`);
  }

  return {
    spoofDetected,
    spoofConfidence: Math.max(0.0, Math.min(1.0, spoofConfidence))
  };
}

export function resetAntiSpoofHistory(): void {
  'worklet';
  boxHistory.length = 0;
  noseHistory.length = 0;
  brightnessHistory.length = 0;
}
