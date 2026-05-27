export type Keypoint = {
  x: number;
  y: number;
};

const eyeContrastHistory: number[] = [];
const eyeContrastTimestamps: number[] = [];
let lastSmoothedVar = -1;
let lastBlinkTime = 0;
let dipStartTime = 0;
let isDipped = false;

// Temporal confidence score for liveness tracking
let livenessConfidence = 0.0;

/**
 * Detects a blink using local patch variance over eyes in the 128x128 BlazeFace image.
 * Validates blink valley duration (100ms - 450ms) and eye-state smoothing.
 */
export function detectBlink(
  blazePixels: Float32Array,
  keypoints: Keypoint[],
  isEmulator: boolean = false
): boolean {
  'worklet';
  if (keypoints == null || keypoints.length < 2) {
    livenessConfidence = Math.max(0, livenessConfidence - 0.1);
    return false;
  }
  
  // Extract a 3x3 patch around each eye center
  const getPatchVariance = (eyeX: number, eyeY: number): number => {
    const rx = Math.round(eyeX * 128);
    const ry = Math.round(eyeY * 128);
    
    let sum = 0;
    let count = 0;
    const values: number[] = [];
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = rx + dx;
        const py = ry + dy;
        if (px >= 0 && px < 128 && py >= 0 && py < 128) {
          const idx = (py * 128 + px) * 3;
          const r = blazePixels[idx];
          const g = blazePixels[idx + 1];
          const b = blazePixels[idx + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          sum += gray;
          values.push(gray);
          count++;
        }
      }
    }
    
    if (count === 0) return 0;
    const mean = sum / count;
    let varianceSum = 0;
    for (let i = 0; i < values.length; i++) {
      varianceSum += (values[i] - mean) * (values[i] - mean);
    }
    return Math.sqrt(varianceSum / count);
  };
  
  const rightEyeVar = getPatchVariance(keypoints[0].x, keypoints[0].y);
  const leftEyeVar = getPatchVariance(keypoints[1].x, keypoints[1].y);
  const avgVar = (rightEyeVar + leftEyeVar) / 2;
  
  // 1. EMA Smoothing (Eye-state smoothing)
  const alpha = isEmulator ? 0.40 : 0.55;
  let smoothed = avgVar;
  if (lastSmoothedVar >= 0) {
    smoothed = alpha * avgVar + (1 - alpha) * lastSmoothedVar;
  }
  lastSmoothedVar = smoothed;
  
  const now = Date.now();
  
  // 2. Add to history with strict buffer limit
  eyeContrastHistory.push(smoothed);
  eyeContrastTimestamps.push(now);
  if (eyeContrastHistory.length > 10) {
    eyeContrastHistory.shift();
    eyeContrastTimestamps.shift();
  }
  
  if (eyeContrastHistory.length < 5) return false;
  
  // 3. Valley Detection & Duration Validation
  const len = eyeContrastHistory.length;
  const latest = eyeContrastHistory[len - 1];
  
  // Find baseline
  let baselineMax = -Infinity;
  const checkLimit = Math.min(len - 2, 4);
  for (let i = 0; i < checkLimit; i++) {
    if (eyeContrastHistory[i] > baselineMax) {
      baselineMax = eyeContrastHistory[i];
    }
  }
  
  // Find local minimum in recent frames
  let localMin = Infinity;
  let localMinIdx = -1;
  for (let i = checkLimit; i < len - 1; i++) {
    if (eyeContrastHistory[i] < localMin) {
      localMin = eyeContrastHistory[i];
      localMinIdx = i;
    }
  }
  
  const dropRatio = isEmulator ? 0.88 : 0.78; 
  const recoveryRatio = isEmulator ? 1.08 : 1.18;
  
  const hasDropped = localMin < baselineMax * dropRatio;
  const hasRecovered = latest > localMin * recoveryRatio;
  
  if (hasDropped && !isDipped) {
    isDipped = true;
    dipStartTime = eyeContrastTimestamps[localMinIdx];
  }
  
  if (hasDropped && hasRecovered && isDipped) {
    const dipDuration = now - dipStartTime;
    
    // Reset dip state
    isDipped = false;
    
    // Validate blink duration: typical human blink is 100ms to 400ms.
    // If it's too fast or too slow (e.g. static photo holding), reject it.
    if (dipDuration >= 100 && dipDuration <= 450 && (now - lastBlinkTime > 1500)) {
      lastBlinkTime = now;
      livenessConfidence = Math.min(1.0, livenessConfidence + 0.35);
      console.log(`[Liveness] Blink verified! Duration: ${dipDuration}ms, Confidence: ${livenessConfidence.toFixed(2)}`);
      console.log('Blink verified');
      return true;
    } else {
      livenessConfidence = Math.max(0, livenessConfidence - 0.15);
      if (dipDuration < 100 || dipDuration > 450) {
        console.log(`[Liveness] Blink rejected due to invalid duration: ${dipDuration}ms`);
      }
    }
  }
  
  return false;
}

export function getBlinkConfidence(): number {
  'worklet';
  return livenessConfidence;
}

export function resetBlinkHistory(): void {
  'worklet';
  eyeContrastHistory.length = 0;
  eyeContrastTimestamps.length = 0;
  lastSmoothedVar = -1;
  isDipped = false;
  dipStartTime = 0;
  livenessConfidence = 0.0;
}
