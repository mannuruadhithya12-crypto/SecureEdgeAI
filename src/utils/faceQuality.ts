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

/**
 * Checks average brightness of the resized frame.
 * @param pixels Float32Array RGB pixel data
 * @param width image width
 * @param height image height
 * @param isRange255 whether pixels are in 0-255 range (vs 0-1)
 * @param isEmulator relax checks on emulator
 */
export function checkBrightness(
  pixels: Float32Array,
  width: number,
  height: number,
  isRange255: boolean,
  isEmulator: boolean
): boolean {
  'worklet';
  let sum = 0;
  const length = width * height;
  
  for (let i = 0; i < length; i++) {
    const idx = i * 3;
    sum += 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
  }
  
  const avg = sum / length;
  const threshold = isRange255 ? 45.0 : 0.18;
  const finalThreshold = isEmulator ? threshold * 0.7 : threshold;
  
  return avg >= finalThreshold;
}

/**
 * Checks focus/blur using Laplacian variance on the pixels in a single pass.
 * @param pixels Float32Array RGB pixel data
 * @param width image width
 * @param height image height
 * @param isRange255 whether pixels are in 0-255 range (vs 0-1)
 * @param isEmulator relax checks on emulator
 */
export function checkBlur(
  pixels: Float32Array,
  width: number,
  height: number,
  isRange255: boolean,
  isEmulator: boolean
): boolean {
  'worklet';
  let sum = 0;
  let sqSum = 0;
  let count = 0;
  
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
      sum += lap;
      sqSum += lap * lap;
      count++;
    }
  }
  
  if (count === 0) return false;
  const mean = sum / count;
  const variance = (sqSum / count) - (mean * mean);
  
  const threshold = isRange255 ? 5.0 : 0.00008;
  const finalThreshold = isEmulator ? threshold * 0.4 : threshold;
  
  return variance >= finalThreshold;
}

/**
 * Checks if face is too small in the frame.
 */
export function checkFaceSize(
  box: NormalizedBox,
  minPercentage: number = 0.22
): boolean {
  'worklet';
  const width = box.xMax - box.xMin;
  const height = box.yMax - box.yMin;
  return width >= minPercentage && height >= minPercentage;
}

/**
 * Checks eye alignment (roll) and nose centering (yaw).
 */
export function checkFaceAlignment(
  keypoints: Keypoint[],
  isEmulator: boolean
): boolean {
  'worklet';
  if (keypoints == null || keypoints.length < 3) return false;
  
  const rightEye = keypoints[0];
  const leftEye = keypoints[1];
  const nose = keypoints[2];
  
  // 1. Roll angle of the eyes
  const dy = leftEye.y - rightEye.y;
  const dx = leftEye.x - rightEye.x;
  const rollAngle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
  
  const maxRoll = isEmulator ? 30.0 : 20.0;
  if (rollAngle > maxRoll && rollAngle < (180 - maxRoll)) {
    return false;
  }
  
  // 2. Yaw centering: nose between eyes
  const eyesMidX = (leftEye.x + rightEye.x) / 2;
  const eyeDist = Math.sqrt(dx * dx + dy * dy);
  if (eyeDist === 0) return false;
  
  const noseOffsetX = Math.abs(nose.x - eyesMidX);
  const maxOffsetYaw = isEmulator ? 0.45 : 0.35;
  if (noseOffsetX / eyeDist > maxOffsetYaw) {
    return false;
  }
  
  return true;
}

/**
 * Checks if face is too close to frame boundaries.
 */
export function checkEdgeProximity(
  box: NormalizedBox,
  margin: number = 0.05
): boolean {
  'worklet';
  return (
    box.xMin >= margin &&
    box.yMin >= margin &&
    box.xMax <= (1 - margin) &&
    box.yMax <= (1 - margin)
  );
}
