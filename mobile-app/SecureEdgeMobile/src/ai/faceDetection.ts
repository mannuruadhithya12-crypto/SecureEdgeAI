/**
 * BlazeFace Face Detection Implementation for React Native VisionCamera
 */

export interface FaceDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface Anchor {
  xCenter: number;
  yCenter: number;
  h: number;
  w: number;
}

export interface BlazeFaceConfig {
  scoreThreshold: number;
  iouThreshold: number;
  inputWidth: number;
  inputHeight: number;
}

export const BLAZEFACE_CONFIG: BlazeFaceConfig = {
  scoreThreshold: 0.5,
  iouThreshold: 0.3,
  inputWidth: 128,
  inputHeight: 128,
};

/**
 * Generates anchors for BlazeFace (896 anchors for 128x128 input)
 */
export function generateAnchors(): Anchor[] {
  'worklet';
  const anchors: Anchor[] = [];
  const strides = [8, 16];
  
  for (let i = 0; i < strides.length; i++) {
    const stride = strides[i];
    const gridWidth = Math.ceil(BLAZEFACE_CONFIG.inputWidth / stride);
    const gridHeight = Math.ceil(BLAZEFACE_CONFIG.inputHeight / stride);
    const numAnchors = (i === 0) ? 2 : 6;

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        for (let anchorIdx = 0; anchorIdx < numAnchors; anchorIdx++) {
          anchors.push({
            xCenter: (x + 0.5) * stride / BLAZEFACE_CONFIG.inputWidth,
            yCenter: (y + 0.5) * stride / BLAZEFACE_CONFIG.inputHeight,
            w: 1.0,
            h: 1.0
          });
        }
      }
    }
  }
  return anchors;
}

const anchors = generateAnchors();

export function calculateIoU(box1: FaceDetection, box2: FaceDetection): number {
  'worklet';
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  const width = Math.max(0, x2 - x1);
  const height = Math.max(0, y2 - y1);
  const intersection = width * height;

  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const union = area1 + area2 - intersection;

  return intersection / union;
}

export function nonMaximumSuppression(detections: FaceDetection[]): FaceDetection[] {
  'worklet';
  if (detections.length === 0) return [];

  const sorted = detections.slice().sort((a, b) => b.confidence - a.confidence);
  const result: FaceDetection[] = [];

  while (sorted.length > 0) {
    const best = sorted.shift()!;
    result.push(best);

    for (let i = 0; i < sorted.length; i++) {
      if (calculateIoU(best, sorted[i]) > BLAZEFACE_CONFIG.iouThreshold) {
        sorted.splice(i, 1);
        i--;
      }
    }
  }

  return result;
}

export function processBlazeFaceOutput(
  outputs: ArrayBuffer[]
): FaceDetection | null {
  'worklet';
  if (outputs.length < 2) {
    console.warn(`[BlazeFace] Expected 2 outputs (regressors, classificators), got ${outputs.length}`);
    return null;
  }

  const rawBoxes = outputs[0];
  const rawScores = outputs[1];

  const isFloat32 = rawBoxes.byteLength % 4 === 0;
  const numAnchors = anchors.length; // 896

  let boxes: Float32Array | Uint8Array;
  let scores: Float32Array | Uint8Array;

  if (isFloat32) {
    boxes = new Float32Array(rawBoxes);
    scores = new Float32Array(rawScores);
  } else {
    boxes = new Uint8Array(rawBoxes);
    scores = new Uint8Array(rawScores);
  }

  const detections: FaceDetection[] = [];

  for (let i = 0; i < numAnchors; i++) {
    let score = isFloat32 ? (scores as Float32Array)[i] : (scores as Uint8Array)[i] / 255;

    // Sigmoid for scores
    if (score < -20) score = 0;
    else if (score > 20) score = 1;
    else score = 1.0 / (1.0 + Math.exp(-score));

    if (score > BLAZEFACE_CONFIG.scoreThreshold) {
      const anchor = anchors[i];
      const offset = i * 16; // 16 values: 4 for box, 12 for landmarks

      let ty, tx, th, tw;
      if (isFloat32) {
        const b = boxes as Float32Array;
        ty = b[offset];
        tx = b[offset + 1];
        th = b[offset + 2];
        tw = b[offset + 3];
      } else {
        const b = boxes as Uint8Array;
        ty = (b[offset] - 128) / 128.0;
        tx = (b[offset + 1] - 128) / 128.0;
        th = (b[offset + 2] - 128) / 128.0;
        tw = (b[offset + 3] - 128) / 128.0;
      }

      // Box decoding (SSD format)
      const xCenter = (tx / 128.0) * anchor.w + anchor.xCenter;
      const yCenter = (ty / 128.0) * anchor.h + anchor.yCenter;
      const w = (tw / 128.0) * anchor.w;
      const h = (th / 128.0) * anchor.h;

      detections.push({
        x: xCenter - w / 2,
        y: yCenter - h / 2,
        width: w,
        height: h,
        confidence: score
      });
    }
  }

  const filtered = nonMaximumSuppression(detections);
  const result = filtered.length > 0 ? filtered[0] : null;

  if (result) {
    console.log("Face detected:", result);
  }

  return result;
}
