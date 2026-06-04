import { Platform } from 'react-native';
import { type BoxedHybridObject } from 'react-native-nitro-modules';
import { type TfliteModel, type Tensor } from 'react-native-fast-tflite';

const MAX_DETECTED_FACES = 5;

export type InputSpec = {
  width: number;
  height: number;
  channels: number;
  dataType: 'float32' | 'uint8';
};

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NormalizedBox = {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
};

export type PreAllocatedBoxes = {
  xMin: Float32Array;
  yMin: Float32Array;
  xMax: Float32Array;
  yMax: Float32Array;
  confidence: Float32Array;
  keypointsX: Float32Array;
  keypointsY: Float32Array;
  count: number;
};

export const preAllocatedBoxes: PreAllocatedBoxes = {
  xMin: new Float32Array(MAX_DETECTED_FACES),
  yMin: new Float32Array(MAX_DETECTED_FACES),
  xMax: new Float32Array(MAX_DETECTED_FACES),
  yMax: new Float32Array(MAX_DETECTED_FACES),
  confidence: new Float32Array(MAX_DETECTED_FACES),
  keypointsX: new Float32Array(MAX_DETECTED_FACES * 6),
  keypointsY: new Float32Array(MAX_DETECTED_FACES * 6),
  count: 0,
};

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

export function generateBlazeFaceAnchors(): Float32Array {
  const strides = [8, 16, 16, 16];
  const min_scale = 0.1484375;
  const max_scale = 0.75;
  const num_layers = 4;
  const input_size = 128;
  
  const anchors = new Float32Array(896 * 4);
  let anchorIdx = 0;
  
  let layer_id = 0;
  while (layer_id < num_layers) {
    const stride = strides[layer_id];
    let last_same_stride_layer = layer_id;
    while (last_same_stride_layer < num_layers && strides[last_same_stride_layer] === stride) {
      last_same_stride_layer++;
    }
    
    const feature_map_height = Math.ceil(input_size / stride);
    const feature_map_width = Math.ceil(input_size / stride);
    
    for (let y = 0; y < feature_map_height; y++) {
      for (let x = 0; x < feature_map_width; x++) {
        for (let l = layer_id; l < last_same_stride_layer; l++) {
          const scale = min_scale + (max_scale - min_scale) * l / (num_layers - 1);
          
          const x_center = (x + 0.5) / feature_map_width;
          const y_center = (y + 0.5) / feature_map_height;
          
          anchors[anchorIdx * 4 + 0] = x_center;
          anchors[anchorIdx * 4 + 1] = y_center;
          anchors[anchorIdx * 4 + 2] = scale;
          anchors[anchorIdx * 4 + 3] = scale;
          anchorIdx++;
          
          const next_scale = l < num_layers - 1
            ? min_scale + (max_scale - min_scale) * (l + 1) / (num_layers - 1)
            : 1.0;
          const interpolated_scale = Math.sqrt(scale * next_scale);
          anchors[anchorIdx * 4 + 0] = x_center;
          anchors[anchorIdx * 4 + 1] = y_center;
          anchors[anchorIdx * 4 + 2] = interpolated_scale;
          anchors[anchorIdx * 4 + 3] = interpolated_scale;
          anchorIdx++;
        }
      }
    }
    layer_id = last_same_stride_layer;
  }
  return anchors;
}

export function decodeBlazeFaceBoxes(
  regressors: Float32Array,
  classificators: Float32Array,
  anchors: Float32Array,
  scoreThreshold: number
): number {
  'worklet';
  preAllocatedBoxes.count = 0;
  let centersCount = 0;
  
  for (let i = 0; i < 896; i++) {
    const rawScore = classificators[i];
    const score = 1 / (1 + Math.exp(-rawScore));
    if (score < scoreThreshold) continue;
    
    const x_center_anchor = anchors[i * 4 + 0];
    const y_center_anchor = anchors[i * 4 + 1];
    const w_anchor = anchors[i * 4 + 2];
    const h_anchor = anchors[i * 4 + 3];
    
    const dx = regressors[i * 16 + 0] / 128.0;
    const dy = regressors[i * 16 + 1] / 128.0;
    const dw = regressors[i * 16 + 2] / 128.0;
    const dh = regressors[i * 16 + 3] / 128.0;
    
    const cx = x_center_anchor + dx * w_anchor;
    const cy = y_center_anchor + dy * h_anchor;
    
    let isNewFace = true;
    for (let j = 0; j < centersCount; j++) {
      const fcx = preAllocatedBoxes.xMin[j] + (preAllocatedBoxes.xMax[j] - preAllocatedBoxes.xMin[j]) / 2;
      const fcy = preAllocatedBoxes.yMin[j] + (preAllocatedBoxes.yMax[j] - preAllocatedBoxes.yMin[j]) / 2;
      const dist = Math.sqrt((cx - fcx) * (cx - fcx) + (cy - fcy) * (cy - fcy));
      
      if (dist < 0.20) {
        isNewFace = false;
        if (score > preAllocatedBoxes.confidence[j]) {
          const w = dw * w_anchor;
          const h = dh * h_anchor;
          
          preAllocatedBoxes.xMin[j] = Math.max(0, Math.min(1, cx - w / 2));
          preAllocatedBoxes.yMin[j] = Math.max(0, Math.min(1, cy - h / 2));
          preAllocatedBoxes.xMax[j] = Math.max(0, Math.min(1, cx + w / 2));
          preAllocatedBoxes.yMax[j] = Math.max(0, Math.min(1, cx + w / 2));
          preAllocatedBoxes.confidence[j] = score;
          
          for (let k = 0; k < 6; k++) {
            const kx_reg = regressors[i * 16 + 4 + k * 2] / 128.0;
            const ky_reg = regressors[i * 16 + 4 + k * 2 + 1] / 128.0;
            preAllocatedBoxes.keypointsX[j * 6 + k] = Math.max(0, Math.min(1, x_center_anchor + kx_reg * w_anchor));
            preAllocatedBoxes.keypointsY[j * 6 + k] = Math.max(0, Math.min(1, y_center_anchor + ky_reg * h_anchor));
          }
        }
        break;
      }
    }
    
    if (isNewFace && centersCount < MAX_DETECTED_FACES) {
      const w = dw * w_anchor;
      const h = dh * h_anchor;
      const j = centersCount;
      
      preAllocatedBoxes.xMin[j] = Math.max(0, Math.min(1, cx - w / 2));
      preAllocatedBoxes.yMin[j] = Math.max(0, Math.min(1, cy - h / 2));
      preAllocatedBoxes.xMax[j] = Math.max(0, Math.min(1, cx + w / 2));
      preAllocatedBoxes.yMax[j] = Math.max(0, Math.min(1, cy + h / 2));
      preAllocatedBoxes.confidence[j] = score;
      
      for (let k = 0; k < 6; k++) {
        const kx_reg = regressors[i * 16 + 4 + k * 2] / 128.0;
        const ky_reg = regressors[i * 16 + 4 + k * 2 + 1] / 128.0;
        preAllocatedBoxes.keypointsX[j * 6 + k] = Math.max(0, Math.min(1, x_center_anchor + kx_reg * w_anchor));
        preAllocatedBoxes.keypointsY[j * 6 + k] = Math.max(0, Math.min(1, y_center_anchor + ky_reg * h_anchor));
      }
      centersCount++;
    }
  }
  preAllocatedBoxes.count = centersCount;
  return centersCount;
}

export function unprocessBox(
  box: NormalizedBox,
  rotation: '0deg' | '90deg' | '180deg' | '270deg',
  mirror: boolean
): NormalizedBox {
  'worklet';
  
  let xMin = box.xMin;
  let xMax = box.xMax;
  let yMin = box.yMin;
  let yMax = box.yMax;
  
  if (mirror) {
    const temp = xMin;
    xMin = 1 - xMax;
    xMax = 1 - temp;
  }
  
  if (rotation === '90deg') {
    return {
      xMin: yMin,
      yMin: 1 - xMax,
      xMax: yMax,
      yMax: 1 - xMin,
    };
  }
  if (rotation === '180deg') {
    return {
      xMin: 1 - xMax,
      yMin: 1 - yMax,
      xMax: 1 - xMin,
      yMax: 1 - yMin,
    };
  }
  if (rotation === '270deg') {
    return {
      xMin: 1 - yMax,
      yMin: xMin,
      xMax: 1 - yMin,
      yMax: xMax,
    };
  }
  return { xMin, yMin, xMax, yMax };
}

export function viewToExactArrayBuffer(view: Uint8Array | Float32Array): ArrayBuffer {
  'worklet';
  const buffer = view.buffer as ArrayBuffer;
  return buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

export function rotationForFrame(orientation: string): '0deg' | '90deg' | '180deg' | '270deg' {
  'worklet';
  if (orientation === 'landscape-left') {
    return '90deg';
  }
  if (orientation === 'landscape-right') {
    return '270deg';
  }
  if (orientation === 'portrait-upside-down') {
    return '180deg';
  }
  return '0deg';
}

export function faceCropForFrame(frameWidth: number, frameHeight: number, box?: NormalizedBox): CropRect {
  'worklet';
  if (box != null) {
    const padding = 0.22;
    const boxWidth = box.xMax - box.xMin;
    const boxHeight = box.yMax - box.yMin;
    const side = Math.max(boxWidth * frameWidth, boxHeight * frameHeight) * (1 + padding);
    const centerX = ((box.xMin + box.xMax) / 2) * frameWidth;
    const centerY = ((box.yMin + box.yMax) / 2) * frameHeight;

    const cropSide = clamp(side, 32, Math.min(frameWidth, frameHeight));
    return {
      x: clamp(centerX - cropSide / 2, 0, frameWidth - cropSide),
      y: clamp(centerY - cropSide / 2, 0, frameHeight - cropSide),
      width: cropSide,
      height: cropSide,
    };
  }

  const side = Math.min(frameWidth, frameHeight) * 0.72;
  return {
    x: (frameWidth - side) / 2,
    y: (frameHeight - side) / 2,
    width: side,
    height: side,
  };
}

export function isAndroidEmulator(): boolean {
  if (Platform.OS !== 'android') {
    return false;
  }
  const model = String(Platform.constants?.Model ?? '');
  const fingerprint = String(Platform.constants?.Fingerprint ?? '');
  return (
    model.includes('sdk') ||
    model.includes('Emulator') ||
    fingerprint.includes('generic') ||
    fingerprint.includes('sdk')
  );
}

export function tensorToInputSpec(tensor: Tensor | undefined, fallback: InputSpec): InputSpec {
  if (tensor == null) {
    return fallback;
  }
  const shape = tensor.shape.filter(value => value > 0);
  const channels = (shape.at(-1) ?? fallback.channels) as 3;
  const width = shape.length >= 3 ? shape.at(-2) ?? fallback.width : fallback.width;
  const height = shape.length >= 3 ? shape.at(-3) ?? fallback.height : fallback.height;
  const dataType = tensor.dataType === 'uint8' ? 'uint8' : 'float32';

  if (width <= 0 || height <= 0 || channels <= 0) {
    return fallback;
  }
  return { width, height, channels, dataType };
}

export function readInputSpec(model: TfliteModel | undefined, fallback: InputSpec): InputSpec | undefined {
  if (model == null) {
    return undefined;
  }
  try {
    return tensorToInputSpec(model.inputs[0], fallback);
  } catch (error) {
    console.warn('Failed to read model input tensor metadata. Using fallback shape.', error);
    return fallback;
  }
}

export function boxTfliteModel(model: TfliteModel | undefined): { value?: BoxedHybridObject<TfliteModel>; error?: string } {
  if (model == null) {
    return {};
  }
  try {
    const { NitroModules } = require('react-native-nitro-modules');
    return {
      value: NitroModules.box(model),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
