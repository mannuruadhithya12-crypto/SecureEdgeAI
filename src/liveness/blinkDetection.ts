export type Keypoint = {
  x: number;
  y: number;
};

const eyeContrastHistory: number[] = [];

export function detectBlink(
  blazePixels: Float32Array,
  keypoints: Keypoint[]
): boolean {
  'worklet';
  if (keypoints == null || keypoints.length < 2) return false;
  
  // Extract a 3x3 patch around each eye center in the 128x128 image
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
  
  eyeContrastHistory.push(avgVar);
  if (eyeContrastHistory.length > 8) {
    eyeContrastHistory.shift();
  }
  
  if (eyeContrastHistory.length < 4) return false;
  
  let max = -Infinity;
  for (let i = 0; i < eyeContrastHistory.length - 1; i++) {
    const val = eyeContrastHistory[i];
    if (val > max) max = val;
  }
  
  const current = avgVar;
  const threshold = max * 0.80; // 20% drop in contrast
  
  if (current < threshold) {
    console.log(`[Liveness] Blink detected! Current variance: ${current.toFixed(4)}, max: ${max.toFixed(4)}`);
    console.log('Blink detected');
    return true;
  }
  
  return false;
}
export function resetBlinkHistory(): void {
  'worklet';
  eyeContrastHistory.length = 0;
}
