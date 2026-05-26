export type Keypoint = {
  x: number;
  y: number;
};

const eyeContrastHistory: number[] = [];
let lastSmoothedVar = -1;
let lastBlinkTime = 0;

/**
 * Detects a blink using local patch variance over eyes in the 128x128 BlazeFace image.
 * Uses EMA smoothing and valley detection to avoid false positives.
 */
export function detectBlink(
  blazePixels: Float32Array,
  keypoints: Keypoint[],
  isEmulator: boolean = false
): boolean {
  'worklet';
  if (keypoints == null || keypoints.length < 2) return false;
  
  // Extract a 3x3 patch around each eye center
  const getPatchVariance = (eyeX: number, eyeY: number): number => {
    const rx = Math.round(eyeX * 128);
    const ry = Math.round(eyeY * 128);
    
    let sum = 0;
    let count = 0;
    const values: number[] = []; // In a worklet, small local arrays are fine, but let's be careful
    
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
  
  // 1. EMA Smoothing (CHANGE-2 / TASK-3)
  const alpha = isEmulator ? 0.40 : 0.55;
  let smoothed = avgVar;
  if (lastSmoothedVar >= 0) {
    smoothed = alpha * avgVar + (1 - alpha) * lastSmoothedVar;
  }
  lastSmoothedVar = smoothed;
  
  // 2. Add to history with strict buffer limit (CHANGE-10: blink history max = 10)
  eyeContrastHistory.push(smoothed);
  if (eyeContrastHistory.length > 10) {
    eyeContrastHistory.shift();
  }
  
  if (eyeContrastHistory.length < 5) return false;
  
  // 3. Valley Detection
  // We look for a dip in the middle of our history queue
  const len = eyeContrastHistory.length;
  const latest = eyeContrastHistory[len - 1];
  
  // Find baseline (maximum variance before the dip)
  let baselineMax = -Infinity;
  const checkLimit = Math.min(len - 2, 4);
  for (let i = 0; i < checkLimit; i++) {
    if (eyeContrastHistory[i] > baselineMax) {
      baselineMax = eyeContrastHistory[i];
    }
  }
  
  // Find local minimum in recent frames
  let localMin = Infinity;
  for (let i = checkLimit; i < len - 1; i++) {
    if (eyeContrastHistory[i] < localMin) {
      localMin = eyeContrastHistory[i];
    }
  }
  
  // Thresholds based on mode (CHANGE-12)
  const dropRatio = isEmulator ? 0.88 : 0.78; // 12% drop for emulator, 22% drop for real device
  const recoveryRatio = isEmulator ? 1.08 : 1.18; // 8% recovery for emulator, 18% for real device
  
  const hasDropped = localMin < baselineMax * dropRatio;
  const hasRecovered = latest > localMin * recoveryRatio;
  
  const now = Date.now();
  if (hasDropped && hasRecovered && (now - lastBlinkTime > 1500)) {
    lastBlinkTime = now;
    console.log(`[Liveness] Blink detected! baseline: ${baselineMax.toFixed(2)}, min: ${localMin.toFixed(2)}, latest: ${latest.toFixed(2)}`);
    console.log('Blink detected');
    return true;
  }
  
  return false;
}

export function resetBlinkHistory(): void {
  'worklet';
  eyeContrastHistory.length = 0;
  lastSmoothedVar = -1;
}
