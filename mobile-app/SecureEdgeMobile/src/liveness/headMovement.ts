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

let lastSmoothedX = -999;
let lastSmoothedY = -999;

const noseHistoryX: number[] = [];
const noseHistoryY: number[] = [];
let lastMovementTime = 0;
let consecutiveMovementFrames = 0;
let headLivenessConfidence = 0.0;

/**
 * Detects head movement by monitoring the relative position of the nose tip.
 * Employs movement history buffers, smoothing, and consecutive motion validations.
 */
export function detectHeadMovement(
  box: NormalizedBox,
  keypoints: Keypoint[],
  isEmulator: boolean = false
): boolean {
  'worklet';
  if (keypoints == null || keypoints.length < 3) {
    headLivenessConfidence = Math.max(0.0, headLivenessConfidence - 0.05);
    consecutiveMovementFrames = 0;
    return false;
  }
  
  const nose = keypoints[2];
  const boxCenterX = (box.xMin + box.xMax) / 2;
  const boxCenterY = (box.yMin + box.yMax) / 2;
  const boxWidth = box.xMax - box.xMin;
  const boxHeight = box.yMax - box.yMin;
  
  if (boxWidth === 0 || boxHeight === 0) return false;
  
  // Normalize nose offset relative to face size
  const relativeX = (nose.x - boxCenterX) / boxWidth;
  const relativeY = (nose.y - boxCenterY) / boxHeight;
  
  // 1. EMA Smoothing to filter frame jitter
  const alpha = isEmulator ? 0.35 : 0.50;
  let smoothedX = relativeX;
  let smoothedY = relativeY;
  
  if (lastSmoothedX > -900) {
    smoothedX = alpha * relativeX + (1 - alpha) * lastSmoothedX;
    smoothedY = alpha * relativeY + (1 - alpha) * lastSmoothedY;
  }
  lastSmoothedX = smoothedX;
  lastSmoothedY = smoothedY;
  
  // 2. Add to history queues with strict buffer limit
  noseHistoryX.push(smoothedX);
  if (noseHistoryX.length > 10) {
    noseHistoryX.shift();
  }
  
  noseHistoryY.push(smoothedY);
  if (noseHistoryY.length > 10) {
    noseHistoryY.shift();
  }
  
  if (noseHistoryX.length < 6) return false;
  
  // 3. Compute range of movement in history window (max - min)
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < noseHistoryX.length; i++) {
    const val = noseHistoryX[i];
    if (val < minX) minX = val;
    if (val > maxX) maxX = val;
  }
  const rangeX = maxX - minX;
  
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < noseHistoryY.length; i++) {
    const val = noseHistoryY[i];
    if (val < minY) minY = val;
    if (val > maxY) maxY = val;
  }
  const rangeY = maxY - minY;
  
  // Adaptive thresholds based on environment/mode
  const thresholdX = isEmulator ? 0.05 : 0.085;
  const thresholdY = isEmulator ? 0.05 : 0.085;
  
  const isMoving = rangeX > thresholdX || rangeY > thresholdY;
  
  if (isMoving) {
    consecutiveMovementFrames++;
  } else {
    consecutiveMovementFrames = Math.max(0, consecutiveMovementFrames - 1);
  }
  
  const now = Date.now();
  // 4. Enforce consecutive frames of movement to filter out one-frame jitter spikes
  if (isMoving && consecutiveMovementFrames >= 3 && (now - lastMovementTime > 1500)) {
    lastMovementTime = now;
    headLivenessConfidence = Math.min(1.0, headLivenessConfidence + 0.40);
    console.log(`[Liveness] Head movement verified! RangeX: ${rangeX.toFixed(4)}, RangeY: ${rangeY.toFixed(4)}, Confidence: ${headLivenessConfidence.toFixed(2)}`);
    console.log('Head movement verified');
    return true;
  }
  
  return false;
}

export function getHeadMovementConfidence(): number {
  'worklet';
  return headLivenessConfidence;
}

export function resetHeadMovementHistory(): void {
  'worklet';
  lastSmoothedX = -999;
  lastSmoothedY = -999;
  noseHistoryX.length = 0;
  noseHistoryY.length = 0;
  consecutiveMovementFrames = 0;
  headLivenessConfidence = 0.0;
}
