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

let lastNoseOffset: { x: number; y: number } | undefined;
let yawMovement = 0;
let pitchMovement = 0;

export function detectHeadMovement(
  box: NormalizedBox,
  keypoints: Keypoint[]
): boolean {
  'worklet';
  if (keypoints == null || keypoints.length < 3) return false; // Nose tip is keypoint 2
  
  const nose = keypoints[2];
  const boxCenterX = (box.xMin + box.xMax) / 2;
  const boxCenterY = (box.yMin + box.yMax) / 2;
  const boxWidth = box.xMax - box.xMin;
  const boxHeight = box.yMax - box.yMin;
  
  // Normalize nose position relative to the face size
  const relativeX = (nose.x - boxCenterX) / boxWidth;
  const relativeY = (nose.y - boxCenterY) / boxHeight;
  
  if (lastNoseOffset == null) {
    lastNoseOffset = { x: relativeX, y: relativeY };
    return false;
  }
  
  const dx = Math.abs(relativeX - lastNoseOffset.x);
  const dy = Math.abs(relativeY - lastNoseOffset.y);
  
  // Update last position slowly
  lastNoseOffset.x = lastNoseOffset.x * 0.8 + relativeX * 0.2;
  lastNoseOffset.y = lastNoseOffset.y * 0.8 + relativeY * 0.2;
  
  // Accumulate movement
  yawMovement = yawMovement * 0.95 + dx;
  pitchMovement = pitchMovement * 0.95 + dy;
  
  // If accumulated yaw or pitch exceeds a threshold, head movement is verified
  if (yawMovement > 0.08 || pitchMovement > 0.08) {
    console.log(`[Liveness] Head movement verified! Yaw: ${yawMovement.toFixed(4)}, Pitch: ${pitchMovement.toFixed(4)}`);
    console.log('Head movement verified');
    return true;
  }
  
  return false;
}

export function resetHeadMovementHistory(): void {
  'worklet';
  lastNoseOffset = undefined;
  yawMovement = 0;
  pitchMovement = 0;
}
