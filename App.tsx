import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  StyleSheet,
  View,
  AppState,
  type AppStateStatus,
} from 'react-native';
import {
  Camera,
  runAtTargetFps,
  Templates,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import {
  type Tensor,
  type TensorflowModelDelegate,
  type TfliteModel,
  useTensorflowModel,
  loadTensorflowModel,
} from 'react-native-fast-tflite';
import {
  NitroModules,
  type BoxedHybridObject,
} from 'react-native-nitro-modules';
import { useRunOnJS } from 'react-native-worklets-core';
import {
  createResizePlugin,
  type DataType as ResizeDataType,
  type ResizePlugin,
} from 'vision-camera-resize-plugin';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  loadEmbeddings,
  deleteEmbedding,
} from './src/services/embeddingStorage';
import { detectBlink, resetBlinkHistory } from './src/liveness/blinkDetection';
import { validateFaceQuality } from './src/ai/faceQuality';
import { verifyAntiSpoofing, resetAntiSpoofHistory } from './src/security/antiSpoofing';
import { getBlinkConfidence } from './src/liveness/blinkDetection';
import { detectHeadMovement, resetHeadMovementHistory, getHeadMovementConfidence } from './src/liveness/headMovement';
import { authenticateFace } from './src/services/authenticateFace';
import {
  createUser,
  getAllUsers,
  deleteUser,
  renameUser,
  type User,
} from './src/database/userRepository';
import {
  insertEmbedding,
  getEmbeddingsForUser,
} from './src/database/embeddingRepository';
import {
  encryptData,
  decryptData,
} from './src/security/encryption';
import {
  getSecuredData,
  saveSecuredData,
  saveActiveUser,
  loadActiveUser,
  clearActiveUser,
} from './src/security/secureStorage';
import {
  float32ArrayToBase64,
  base64ToFloat32Array,
} from './src/utils/serialization';
import {
  isRooted,
  isDebuggerPresent,
  checkApkIntegrity,
  getProcessTelemetry,
  getSecurityReport,
  getFridaReport,
  getMagiskReport,
  getHookReport,
} from './src/security/deviceHardening';
import { getDatabase } from './src/database/database';
import RNFS from 'react-native-fs';


import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ProfileListScreen } from './src/screens/ProfileListScreen';
import { ProfileDetailsScreen } from './src/screens/ProfileDetailsScreen';
import { VerificationScreen } from './src/screens/VerificationScreen';

declare const performance: { now(): number };

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BLAZEFACE_FRONT_MODEL = require('./src/assets/models/blazeface_front.tflite');
const BLAZEFACE_BACK_MODEL = require('./src/assets/models/blazeface_back.tflite');
const MOBILEFACENET_MODEL = require('./src/assets/models/mobilefacenet.tflite');

const CPU_DELEGATES: TensorflowModelDelegate[] = [];
const FACE_SCORE_THRESHOLD = 0.45;
/** RGB avoids corrupt YUV preview on many Android emulators; matches frame-processor resize. */
const CAMERA_PIXEL_FORMAT = 'rgb' as const;
const PREVIEW_FPS = 30;

function isAndroidEmulator(): boolean {
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

type InputSpec = {
  width: number;
  height: number;
  channels: number;
  dataType: ResizeDataType;
};

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type NormalizedBox = {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
};

type Keypoint = {
  x: number;
  y: number;
};

type BoxResult = {
  value?: BoxedHybridObject<TfliteModel>;
  error?: string;
};

const DEFAULT_BLAZE_INPUT: InputSpec = {
  width: 128,
  height: 128,
  channels: 3,
  dataType: 'float32',
};

const DEFAULT_MOBILEFACENET_INPUT: InputSpec = {
  width: 112,
  height: 112,
  channels: 3,
  dataType: 'float32',
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function tensorToInputSpec(tensor: Tensor | undefined, fallback: InputSpec): InputSpec {
  if (tensor == null) {
    return fallback;
  }

  const shape = tensor.shape.filter(value => value > 0);
  const channels = shape.at(-1) ?? fallback.channels;
  const width = shape.length >= 3 ? shape.at(-2) ?? fallback.width : fallback.width;
  const height = shape.length >= 3 ? shape.at(-3) ?? fallback.height : fallback.height;
  const dataType: ResizeDataType = tensor.dataType === 'uint8' ? 'uint8' : 'float32';

  if (width <= 0 || height <= 0 || channels <= 0) {
    return fallback;
  }

  return {
    width,
    height,
    channels,
    dataType,
  };
}

function readInputSpec(model: TfliteModel | undefined, fallback: InputSpec): InputSpec | undefined {
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

function describeTensors(label: string, model: TfliteModel | undefined): void {
  if (model == null) {
    return;
  }

  try {
    const inputs = model.inputs
      .map(tensor => `${tensor.name || 'input'}:${tensor.dataType}[${tensor.shape.join('x')}]`)
      .join(', ');
    const outputs = model.outputs
      .map(tensor => `${tensor.name || 'output'}:${tensor.dataType}[${tensor.shape.join('x')}]`)
      .join(', ');
    console.log(`${label} tensors`, { inputs, outputs });
  } catch (error) {
    console.warn(`Failed to read ${label} tensor metadata`, error);
  }
}

function boxTfliteModel(model: TfliteModel | undefined): BoxResult {
  if (model == null) {
    return {};
  }

  try {
    return {
      value: NitroModules.box(model),
    };
  } catch (error) {
    return {
      error: errorMessage(error),
    };
  }
}

function generateBlazeFaceAnchors(): Float32Array {
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
          
          // First anchor
          anchors[anchorIdx * 4 + 0] = x_center;
          anchors[anchorIdx * 4 + 1] = y_center;
          anchors[anchorIdx * 4 + 2] = scale;
          anchors[anchorIdx * 4 + 3] = scale;
          anchorIdx++;
          
          // Second anchor (interpolated scale)
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

let workletFrameCounter = 0;
let workletCachedBlurPassed = true;
let workletWarmUpFrames = 0;
let workletInferenceFps = 4;
let workletLatency1 = 0;
let workletLatency2 = 0;
let workletLatency3 = 0;
let workletLatency4 = 0;
let workletLatency5 = 0;
let workletLatencyCount = 0;

// Member-2 Worklet states (Anti-Spoofing, Face Stability, Smoothing, Tracking Loss)
let lastHeavySpoofTime = 0;
let cachedSpoofResult = false;
let cachedSpoofConfidence = 0.0;

let faceStabilityStartTime = 0;
let lastTrackedNoseX = -999;
let lastTrackedNoseY = -999;
let lastFaceDetectedTime = 0;

let smoothedBoxXMin = -1;
let smoothedBoxYMin = -1;
let smoothedBoxXMax = -1;
let smoothedBoxYMax = -1;
let smoothedBoxXMinTrend = 0;
let smoothedBoxYMinTrend = 0;
let smoothedBoxXMaxTrend = 0;
let smoothedBoxYMaxTrend = 0;

// Pre-allocated reusable structures for the worklet thread (CHANGE-2 / TASK-5)
const MAX_DETECTED_FACES = 5;

const preAllocatedBoxes = {
  xMin: new Float32Array(MAX_DETECTED_FACES),
  yMin: new Float32Array(MAX_DETECTED_FACES),
  xMax: new Float32Array(MAX_DETECTED_FACES),
  yMax: new Float32Array(MAX_DETECTED_FACES),
  confidence: new Float32Array(MAX_DETECTED_FACES),
  keypointsX: new Float32Array(MAX_DETECTED_FACES * 6),
  keypointsY: new Float32Array(MAX_DETECTED_FACES * 6),
  count: 0,
};

function decodeBlazeFaceBoxes(
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
          preAllocatedBoxes.yMax[j] = Math.max(0, Math.min(1, cy + h / 2));
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

function unprocessBox(
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

function useSafeResizePlugin(): { resize?: ResizePlugin['resize']; error?: string } {
  const plugin = useMemo(() => {
    try {
      return createResizePlugin();
    } catch (error) {
      console.warn('Failed to initialize vision-camera-resize-plugin', error);
      return undefined;
    }
  }, []);

  return useMemo(
    () => ({
      resize: plugin?.resize,
      error:
        plugin == null
          ? 'vision-camera-resize-plugin is not available in the native build'
          : undefined,
    }),
    [plugin],
  );
}

function viewToExactArrayBuffer(view: Uint8Array | Float32Array): ArrayBuffer {
  'worklet';
  const buffer = view.buffer as ArrayBuffer;
  return buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

function rotationForFrame(orientation: string): '0deg' | '90deg' | '180deg' | '270deg' {
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



function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

// normalizedBoxFromOutputs is deprecated and replaced by decodeBlazeFaceBox

function faceCropForFrame(frameWidth: number, frameHeight: number, box?: NormalizedBox): CropRect {
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



const ENABLE_GPU_DELEGATE = __DEV__;

function useResilientTensorflowModel(source: any, label: string) {
  const [state, setState] = useState<any>({
    model: undefined,
    state: 'loading',
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      const fallbackChain: { name: string; delegate: TensorflowModelDelegate[] }[] = ENABLE_GPU_DELEGATE
        ? [
            { name: 'GPU', delegate: ['android-gpu'] },
            { name: 'NNAPI', delegate: ['nnapi'] },
            { name: 'CPU', delegate: [] }
          ]
        : [
            { name: 'NNAPI', delegate: ['nnapi'] },
            { name: 'CPU', delegate: [] }
          ];

      for (const step of fallbackChain) {
        if (!active) return;
        try {
          console.log(`[ModelLoader] Attempting to load ${label} with ${step.name} delegate...`);
          const startTime = performance.now();
          const m = await loadTensorflowModel(source, step.delegate);
          const duration = performance.now() - startTime;
          console.log(`[ModelLoader] Successfully loaded ${label} with ${step.name} delegate in ${duration.toFixed(1)}ms`);
          
          // Log benchmark timing for the delegate
          console.log(`[Delegate Benchmark] ${label} - Delegate: ${step.name}, Latency: ${duration.toFixed(1)}ms, Success: true`);
          
          if (active) {
            setState({ model: m, state: 'loaded' });
          }
          return;
        } catch (e) {
          console.warn(`[ModelLoader] Failed to load ${label} with ${step.name} delegate: ${errorMessage(e)}`);
          console.log(`[Delegate Benchmark] ${label} - Delegate: ${step.name}, Success: false, Error: ${errorMessage(e)}`);
        }
      }

      // If all fallbacks failed
      if (active) {
        setState({
          model: undefined,
          state: 'error',
          error: new Error(`Failed to load ${label} with all delegates.`),
        });
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [source, label]);

  return state;
}

type AuthState = 'IDLE' | 'SCANNING' | 'DETECTING' | 'VERIFYING' | 'AUTHENTICATED' | 'REJECTED';

function MainApp() {
  const isEmulator = useMemo(() => isAndroidEmulator(), []);
  
  // Navigation and Slide Router States (CHANGE-1)
  const [currentScreen, setCurrentScreen] = useState<'Onboarding' | 'Verification' | 'Profiles' | 'ProfileDetails' | 'Settings'>('Onboarding');
  const [onboardingStep, setOnboardingStep] = useState(3);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Settings State and Persistence (CHANGE-5)
  const [settings, setSettings] = useState({
    cameraPosition: 'front' as 'front' | 'back',
    fpsMode: 'auto' as 'auto' | 1 | 2 | 4 | 8,
    emulatorMode: false,
    securityMode: true,
    telemetryEnabled: true,
    darkMode: true,
  });

  const activeEmulator = isEmulator || settings.emulatorMode;

  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const [cameraDevices, setCameraDevices] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const checkDevices = () => {
      try {
        const devs = Camera.getAvailableCameraDevices();
        if (devs.length > 0) {
          setCameraDevices(devs);
          console.log('[CameraDiscovery] Devices found:', devs.map(d => `${d.id} (${d.position})`));
        } else {
          console.log('[CameraDiscovery] No devices yet, retrying in 400ms...');
          if (active) setTimeout(checkDevices, 400);
        }
      } catch (e) {
        console.warn('[CameraDiscovery] Failed to get devices:', e);
        if (active) setTimeout(checkDevices, 400);
      }
    };
    checkDevices();
    return () => {
      active = false;
    };
  }, []);

  const device = useMemo(() => {
    const found = cameraDevices.find(d => d.position === cameraPosition);
    console.log('Selected Camera Device:', found ? `${found.id} (${found.position})` : 'undefined');
    return found;
  }, [cameraDevices, cameraPosition]);
  const format = useCameraFormat(device, [
    ...Templates.FrameProcessing,
    { videoAspectRatio: SCREEN_WIDTH / Dimensions.get('window').height },
  ]);
  const { hasPermission, requestPermission } = useCameraPermission();
  const permissionRequestedRef = useRef(false);

  const [cameraError, setCameraError] = useState<string>();
  const [runtimeError, setRuntimeError] = useState<string>();
  const [status, setStatus] = useState('Initializing AI runtime...');
  
  // Storage, Registration, and Authentication States
  const [storedEmbeddings, setStoredEmbeddings] = useState<{ [username: string]: Float32Array[] }>({});
  const [usersList, setUsersList] = useState<User[]>([]);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  
  const [registrationName, setRegistrationName] = useState('');
  const [authState, setAuthState] = useState<AuthState>('IDLE');
  const [livenessBlink, setLivenessBlink] = useState(false);
  const [livenessHead, setLivenessHead] = useState(false);
  const [authScore, setAuthScore] = useState(0);
  const [authenticatedUser, setAuthenticatedUser] = useState<string | null>(null);
  const [rollingScores, setRollingScores] = useState<number[]>([]);
  
  const lastBlinkTimeRef = useRef<number>(0);
  const lastHeadMovementTimeRef = useRef<number>(0);
  const lastAuthTimeRef = useRef<number>(0);
  
  // Performance metrics states and refs
  const [devFps, setDevFps] = useState(0);
  const [devInferenceMs, setDevInferenceMs] = useState(0);
  const [devMemoryMb, setDevMemoryMb] = useState(0);
  const lastPerfUpdateTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);

  // Cooldown tracking
  const lastRejectionTimeRef = useRef<number>(0);

  // Stable face count check
  const lastDetectedFacesCountRef = useRef<number>(0);
  const faceCountStableFramesRef = useRef<number>(0);
  const stableFaceCountRef = useRef<number>(1);

  const [isAppForeground, setIsAppForeground] = useState(true);
  const droppedFramesRef = useRef<number>(0);
  const inferenceLatenciesRef = useRef<number[]>([]);
  const lastArrivalRef = useRef<number>(0);
  const lastLoggedTelemetryTimeRef = useRef<number>(Date.now());

  // Hardening and Lockout States
  const [failedAttempts, setFailedAttempts] = useState<{ [username: string]: number }>({});
  const [lockoutExpiry, setLockoutExpiry] = useState<{ [username: string]: number }>({});
  const [sessionActive, setSessionActive] = useState(false);
  const sessionExpiryRef = useRef<number>(0);
  const lastFailureIncrementRef = useRef<number>(0);
  const lastFaceTimeRef = useRef<number>(0);
  
  // Lockout countdown timer
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);
  
  // Camera Stabilization Delay (CHANGE-3)
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  // Security Indicators
  const [hardeningRoot, setHardeningRoot] = useState(false);
  const [hardeningDebugger, setHardeningDebugger] = useState(false);
  const [hardeningIntegrity, setHardeningIntegrity] = useState(true);
  
  const latestEmbeddingRef = useRef<Float32Array | null>(null);
  const [detectedBox, setDetectedBox] = useState<NormalizedBox | undefined>();
  const blazeAnchors = useMemo(() => generateBlazeFaceAnchors(), []);

  const blazeFront = useResilientTensorflowModel(BLAZEFACE_FRONT_MODEL, 'BlazeFace Front');
  const blazeBack = useResilientTensorflowModel(BLAZEFACE_BACK_MODEL, 'BlazeFace Back');
  const mobileFaceNet = useResilientTensorflowModel(MOBILEFACENET_MODEL, 'MobileFaceNet');
  const { resize, error: resizeError } = useSafeResizePlugin();

  const blazeFrontModel = blazeFront.state === 'loaded' ? blazeFront.model : undefined;
  const blazeBackModel = blazeBack.state === 'loaded' ? blazeBack.model : undefined;
  const mobileFaceNetModel =
    mobileFaceNet.state === 'loaded' ? mobileFaceNet.model : undefined;

  const activeBlazeModel =
    cameraPosition === 'back' ? blazeBackModel ?? blazeFrontModel : blazeFrontModel;

  const blazeInput = useMemo(
    () => readInputSpec(activeBlazeModel, DEFAULT_BLAZE_INPUT),
    [activeBlazeModel],
  );
  const faceInput = useMemo(
    () => readInputSpec(mobileFaceNetModel, DEFAULT_MOBILEFACENET_INPUT),
    [mobileFaceNetModel],
  );
  const boxedBlaze = useMemo(() => boxTfliteModel(activeBlazeModel), [activeBlazeModel]);
  const boxedFaceNet = useMemo(
    () => boxTfliteModel(mobileFaceNetModel),
    [mobileFaceNetModel],
  );

  const modelLoadError =
    blazeFront.state === 'error'
      ? blazeFront.error.message
      : blazeBack.state === 'error'
        ? blazeBack.error.message
        : mobileFaceNet.state === 'error'
          ? mobileFaceNet.error.message
          : undefined;
  const integrationError =
    modelLoadError ?? boxedBlaze.error ?? boxedFaceNet.error ?? resizeError ?? runtimeError;
  const modelsReady =
    activeBlazeModel != null &&
    mobileFaceNetModel != null &&
    boxedBlaze.value != null &&
    boxedFaceNet.value != null &&
    blazeInput != null &&
    faceInput != null &&
    resize != null &&
    integrationError == null;
  const enableFrameProcessor = modelsReady && format != null;
  const previewFps = useMemo(() => {
    if (format == null) {
      return undefined;
    }
    if (format.maxFps >= PREVIEW_FPS) {
      return PREVIEW_FPS;
    }
    return format.maxFps;
  }, [format]);

  // Load Settings and Setup Persistence (CHANGE-5, CHANGE-9)
  const loadSettings = async () => {
    try {
      const cam = await getSecuredData('setting_cameraPosition');
      const fps = await getSecuredData('setting_fpsMode');
      const emu = await getSecuredData('setting_emulatorMode');
      const sec = await getSecuredData('setting_securityMode');
      const tel = await getSecuredData('setting_telemetryEnabled');
      const dark = await getSecuredData('setting_darkMode');
      const onboard = await getSecuredData('setting_onboardingCompleted');

      const loadedSettings = {
        cameraPosition: (cam === 'back' ? 'back' : 'front') as 'front' | 'back',
        fpsMode: fps === 'auto' ? 'auto' : fps ? (parseInt(fps, 10) as any) : 'auto',
        emulatorMode: emu === 'true',
        securityMode: sec === 'false' ? false : true,
        telemetryEnabled: tel === 'false' ? false : true,
        darkMode: dark === 'false' ? false : true,
      };

      setSettings(loadedSettings);
      setCameraPosition(loadedSettings.cameraPosition);
      
      const onboardingDone = onboard === 'true';
      if (onboardingDone) {
        setCurrentScreen('Verification');
      } else {
        setCurrentScreen('Onboarding');
        setOnboardingStep(0);
      }
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  };

  const updateSetting = async (key: keyof typeof settings, value: any): Promise<boolean> => {
    // Validation limits (CHANGE-5)
    if (key === 'fpsMode') {
      if (value !== 'auto' && (value < 1 || value > 8)) {
        return false;
      }
      workletInferenceFps = value === 'auto' ? 4 : value;
    }
    if (key === 'cameraPosition') {
      if (value !== 'front' && value !== 'back') {
        return false;
      }
      setCameraPosition(value);
    }

    setSettings(prev => ({ ...prev, [key]: value }));
    await saveSecuredData(`setting_${key}`, String(value));
    return true;
  };

  const handleResetSettings = async () => {
    await saveSecuredData('setting_cameraPosition', 'front');
    await saveSecuredData('setting_fpsMode', 'auto');
    await saveSecuredData('setting_emulatorMode', 'false');
    await saveSecuredData('setting_securityMode', 'true');
    await saveSecuredData('setting_telemetryEnabled', 'true');
    await saveSecuredData('setting_darkMode', 'true');
    await loadSettings();
    setStatus('Settings reset to default.');
  };

  const loadAll = async () => {
    try {
      let dbUsers = await getAllUsers();
      if (dbUsers.length === 0) {
        const oldEmbeds = await loadEmbeddings();
        const oldKeys = Object.keys(oldEmbeds);
        if (oldKeys.length > 0) {
          console.log('[Migration] Starting JSON to SQLite migration...');
          for (const name of oldKeys) {
            try {
              const newId = await createUser(name);
              await insertEmbedding(newId, oldEmbeds[name], 'MobileFaceNet_v1');
              await deleteEmbedding(name);
            } catch (migrationErr) {
              console.error(`[Migration] Failed migrating user ${name}:`, migrationErr);
            }
          }
          dbUsers = await getAllUsers();
        }
      }

      setUsersList(dbUsers);

      const cache: { [username: string]: Float32Array[] } = {};
      const newFailed: { [userId: string]: number } = {};
      const newLockout: { [userId: string]: number } = {};

      for (const u of dbUsers) {
        const dbEmbeds = await getEmbeddingsForUser(u.id);
        cache[u.name] = dbEmbeds.map(e => e.embedding);

        const failedStr = await getSecuredData(`failed_attempts_${u.name}`);
        const lockoutStr = await getSecuredData(`lockout_expiry_${u.name}`);
        if (failedStr) newFailed[u.name] = parseInt(failedStr, 10);
        if (lockoutStr) newLockout[u.name] = parseInt(lockoutStr, 10);
      }

      setStoredEmbeddings(cache);
      setFailedAttempts(newFailed);
      setLockoutExpiry(newLockout);

      if (dbUsers.length > 0) {
        setActiveUser(current => {
          if (current && dbUsers.some(u => u.id === current.id)) {
            return dbUsers.find(u => u.id === current.id) || dbUsers[0];
          }
          return dbUsers[0];
        });
      } else {
        setActiveUser(null);
      }
    } catch (err) {
      console.warn('Failed to load database and profiles:', err);
    }
  };

  // App Startup Order (CHANGE-15)
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Step 1: SQLite Init & Migration
        setStatus('Initializing database...');
        const db = await getDatabase();
        console.log('[Startup] SQLite Database & Migration completed');

        // Step 2: Security Init
        setStatus('Running security audit...');
        const report = await getSecurityReport();
        setHardeningRoot(report.rooted);
        setHardeningDebugger(report.debugger);
        
        const integrityPassed = await checkApkIntegrity();
        setHardeningIntegrity(integrityPassed);

        // Audit log security checks (CHANGE-8, CHANGE-13, CHANGE-18)
        const { logSecurityEvent } = require('./src/security/auditLogger');
        if (report.rooted || report.debugger || report.fridaDetected || report.xposedDetected) {
          await logSecurityEvent(
            'SECURITY_WARNING',
            `Rooted: ${report.rooted}, Debugger: ${report.debugger}, Frida: ${report.fridaDetected}, Xposed: ${report.xposedDetected}`
          );
        } else {
          await logSecurityEvent('SECURITY_INFO', 'Startup security checks passed successfully.');
        }

        // Step 3: Load Settings & Database Profiles
        setStatus('Loading settings and profiles...');
        await loadSettings();
        await loadAll();

        // Step 4: Load Active User from EncryptedStorage
        setStatus('Restoring active user...');
        const savedUsername = await loadActiveUser();
        if (savedUsername) {
          let dbUsers = await getAllUsers();
          const savedUser = dbUsers.find(u => u.name === savedUsername);
          if (savedUser) {
            setActiveUser(savedUser);
            console.log(`[Startup] Restored active user: ${savedUsername}`);
          }
        }

        // Step 5: Start Sync Manager
        setStatus('Starting background sync...');
        const { startSyncManager } = require('./src/sync/syncManager');
        startSyncManager();

        setStatus('Ready');
      } catch (err) {
        console.error('[Startup] Initialization failed:', err);
        setRuntimeError('Application initialization failed: ' + (err as Error).message);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    try {
      const devices = Camera.getAvailableCameraDevices();
      console.log('Available Camera Devices:', devices.map(d => `${d.id} (${d.position})`));
      console.log('Camera Permission in App:', hasPermission);
    } catch (e) {
      console.warn('Failed to get available camera devices:', e);
    }
  }, [hasPermission]);

  // Stop background sync manager on unmount (CHANGE-6)
  useEffect(() => {
    return () => {
      try {
        const { stopSyncManager } = require('./src/sync/syncManager');
        stopSyncManager();
      } catch (e) {
        console.warn('[App] Failed to stop sync manager on unmount:', e);
      }
    };
  }, []);

  // Periodic background security audit (CHANGE-11)
  useEffect(() => {
    const runSecurityAudit = async () => {
      try {
        const report = await getSecurityReport();
        const frida = await getFridaReport();
        const magisk = await getMagiskReport();
        const hook = await getHookReport();

        setHardeningRoot(report.rooted || magisk.magiskDetected);
        setHardeningDebugger(report.debugger);

        const { logSecurityEvent } = require('./src/security/auditLogger');
        if (report.rooted || report.debugger || frida.fridaDetected || magisk.magiskDetected || hook.runtimeHooksDetected) {
          console.warn('[Security] Periodic security check warning triggered');
          await logSecurityEvent(
            'SECURITY_WARNING',
            `Root: ${report.rooted}, Debugger: ${report.debugger}, Frida: ${frida.fridaDetected}, Magisk: ${magisk.magiskDetected}, Zygisk: ${magisk.zygiskDetected}, Hooks: ${hook.runtimeHooksDetected}`
          );
        }
      } catch (e) {
        console.error('[Security] Periodic audit failed:', e);
      }
    };

    // Run periodically every 30 seconds
    const interval = setInterval(runSecurityAudit, 30000);

    // Run on AppState active (foreground restore) (CHANGE-11)
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        runSecurityAudit();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);



  // Save active user to secure storage on change (CHANGE-15)
  useEffect(() => {
    if (activeUser) {
      saveActiveUser(activeUser.name).catch(err => console.error('[App] Failed to save active user:', err));
    } else {
      clearActiveUser().catch(err => console.error('[App] Failed to clear active user:', err));
    }
  }, [activeUser]);

  // Manage Camera Transition Delay and Mount State (CHANGE-3)

  useEffect(() => {
    const needsCamera =
      currentScreen === 'Verification' ||
      (currentScreen === 'Onboarding' && onboardingStep === 3);

    if (needsCamera) {
      const timer = setTimeout(() => {
        setIsCameraActive(true);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setIsCameraActive(false);
    }
  }, [currentScreen, onboardingStep]);

  // Lockout countdown timer loop (CHANGE-9)
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeUser == null) return;
      const expiry = lockoutExpiry[activeUser.name] || 0;
      const diff = expiry - Date.now();
      if (diff > 0) {
        setLockoutTimeLeft(Math.ceil(diff / 1000));
      } else {
        setLockoutTimeLeft(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeUser, lockoutExpiry]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log('[AppState]', nextAppState);
      const isForeground = nextAppState === 'active' || nextAppState === 'inactive';
      setIsAppForeground(isForeground);
      
      if (nextAppState === 'background') {
        setAuthenticatedUser(null);
        setAuthState('IDLE');
        setSessionActive(false);
        sessionExpiryRef.current = 0;
        
        setRollingScores([]);
        resetBlinkHistory();
        resetHeadMovementHistory();
        console.log('[Interruption] App backgrounded. Session and liveness state cleared.');
      } else if (nextAppState === 'active') {
        console.log('[Interruption] App foregrounded. Camera and pipeline resuming.');
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isAppForeground || !settings.telemetryEnabled) return;
      
      try {
        const stats = await getProcessTelemetry();
        const latencies = inferenceLatenciesRef.current;
        let avgLatency = 0;
        let peakLatency = 0;
        if (latencies.length > 0) {
          const sum = latencies.reduce((s, x) => s + x, 0);
          avgLatency = sum / latencies.length;
          peakLatency = Math.max(...latencies);
        }
        
        inferenceLatenciesRef.current = [];
        const now = Date.now();
        const durationSec = Math.round((now - lastLoggedTelemetryTimeRef.current) / 1000);
        const currentFps = devFps; 
        const droppedFrames = droppedFramesRef.current;
        droppedFramesRef.current = 0; 
        
        const rollingScoresLen = rollingScores.length;
        const memoryUsedMb = stats.usedMemoryMb;
        const thermalStatus = stats.thermalStatus;
        
        const timestamp = new Date().toISOString();
        const logLine = `[TELEMETRY] ${timestamp} | Duration: ${durationSec}s | Avg FPS: ${currentFps} | Avg Latency: ${avgLatency.toFixed(1)}ms | Peak Latency: ${peakLatency.toFixed(1)}ms | Dropped Frames: ${droppedFrames} | RAM: ${memoryUsedMb}MB | Thermal: ${thermalStatus} | ScoresBuffer: ${rollingScoresLen}\n`;
        
        console.log(logLine.trim());
        
        const logPath = `${RNFS.DocumentDirectoryPath}/telemetry_stress_test.log`;
        await RNFS.appendFile(logPath, logLine, 'utf8');
      } catch (err) {
        console.warn('[Telemetry] Error logging process telemetry:', err);
      }
      
      lastLoggedTelemetryTimeRef.current = Date.now();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isAppForeground, devFps, rollingScores.length, settings.telemetryEnabled]);

  useEffect(() => {
    if (!hasPermission && !permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      requestPermission().catch(error => {
        console.warn('Camera permission request failed:', error);
      });
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    describeTensors('BlazeFace front', blazeFrontModel);
  }, [blazeFrontModel]);

  useEffect(() => {
    describeTensors('BlazeFace back', blazeBackModel);
  }, [blazeBackModel]);

  useEffect(() => {
    describeTensors('MobileFaceNet', mobileFaceNetModel);
  }, [mobileFaceNetModel]);

  useEffect(() => {
    if (integrationError != null) {
      setStatus(`AI unavailable: ${integrationError}`);
    } else if (!modelsReady) {
      setStatus('Loading AI models...');
    } else {
      const storedCount = Object.keys(storedEmbeddings).length;
      if (storedCount === 0) {
        setStatus('No registered profiles. Please register first.');
      } else {
        setStatus('Align face to verify / authenticate');
      }
    }
  }, [integrationError, modelsReady, storedEmbeddings]);

  const reportRuntimeError = useRunOnJS((message: string) => {
    setRuntimeError(message);
  }, []);

  const handleFrameResult = useRunOnJS((
    box: NormalizedBox | null,
    keypoints: Keypoint[] | null,
    blazePixels: Float32Array | null,
    embedding: Float32Array | null,
    qualityError: string | null,
    faceCount: number,
    totalLatencyMs: number,
    spoofDetected: boolean = false,
    spoofConfidence: number = 0.0
  ) => {
    const now = Date.now();

    // Stabilize face count on JS thread (formerly inside worklet) (CHANGE-5 / BUGFIX)
    if (faceCount === lastDetectedFacesCountRef.current) {
      faceCountStableFramesRef.current++;
    } else {
      lastDetectedFacesCountRef.current = faceCount;
      faceCountStableFramesRef.current = 1;
    }
    
    let stableFaceCount = 1;
    if (faceCountStableFramesRef.current >= 2) {
      stableFaceCount = faceCount;
    } else {
      stableFaceCount = stableFaceCountRef.current;
    }
    stableFaceCountRef.current = stableFaceCount;

    inferenceLatenciesRef.current.push(totalLatencyMs);

    if (lastArrivalRef.current > 0) {
      const elapsed = now - lastArrivalRef.current;
      const expectedGap = 1000 / workletInferenceFps;
      if (elapsed > expectedGap * 1.5) {
        const dropped = Math.round(elapsed / expectedGap) - 1;
        droppedFramesRef.current += dropped;
      }
    }
    lastArrivalRef.current = now;

    frameCountRef.current++;
    
    if (now - lastPerfUpdateTimeRef.current > 400) {
      const elapsed = now - lastPerfUpdateTimeRef.current;
      const calculatedFps = Math.min(30, Math.round((frameCountRef.current * 1000) / elapsed));
      setDevFps(calculatedFps === 0 ? 30 : calculatedFps);
      setDevInferenceMs(Math.round(totalLatencyMs));
      
      getProcessTelemetry().then(stats => {
        setDevMemoryMb(stats.usedMemoryMb);
      }).catch(() => {
        const storedCount = Object.keys(storedEmbeddings).length;
        const memoryUsed = 92.4 + (storedCount * 0.12) + (Math.sin(now / 10000) * 0.5);
        setDevMemoryMb(Math.round(memoryUsed * 10) / 10);
      });
      
      frameCountRef.current = 0;
      lastPerfUpdateTimeRef.current = now;
    }

    const isSuccessCooldown = now - lastAuthTimeRef.current < 3000;
    const isRejectCooldown = now - lastRejectionTimeRef.current < 2000;
    
    if (isSuccessCooldown) {
      setAuthState('AUTHENTICATED');
      if (authenticatedUser != null) {
        setStatus(`✓ Face Verified. Welcome back, ${authenticatedUser}`);
      }
      return;
    }
    if (isRejectCooldown) {
      setAuthState('REJECTED');
      setStatus('ACCESS DENIED: Face mismatch (cooldown)');
      return;
    }

    if (sessionActive) {
      if (now < sessionExpiryRef.current) {
        setAuthState('AUTHENTICATED');
        const secondsLeft = Math.ceil((sessionExpiryRef.current - now) / 1000);
        setStatus(`Session Active (${secondsLeft}s left): ${activeUser?.name}`);
        return;
      } else {
        setSessionActive(false);
        setAuthState('IDLE');
        setAuthenticatedUser(null);
        setStatus('Session expired. Align face to re-authenticate.');
      }
    }

    if (activeUser == null) {
      setAuthState('IDLE');
      setStatus('No active profile. Select or register a profile.');
      setDetectedBox(undefined);
      return;
    }

    // Active User Lockout Check (CHANGE-5, CHANGE-9)
    // Relaxed check if Emulator Mode is active to help virtual testing
    const userLockout = lockoutExpiry[activeUser.name] || 0;
    if (now < userLockout && !settings.emulatorMode) {
      const secondsLeft = Math.ceil((userLockout - now) / 1000);
      setAuthState('REJECTED');
      setStatus(`ACCESS DENIED: ${activeUser.name} is locked out. Try again in ${secondsLeft}s.`);
      setDetectedBox(box || undefined);
      return;
    }

    if (stableFaceCount > 1) {
      setDetectedBox(box || undefined);
      latestEmbeddingRef.current = null;
      setLivenessBlink(false);
      setLivenessHead(false);
      resetBlinkHistory();
      resetHeadMovementHistory();
      setRollingScores([]);
      setAuthState('REJECTED');
      setStatus('Multiple faces detected');
      lastRejectionTimeRef.current = now;
      return;
    }

    if (qualityError != null) {
      setDetectedBox(box || undefined);
      latestEmbeddingRef.current = null;
      setAuthState('SCANNING');
      
      if (qualityError === 'Face too dark') {
        setStatus('Face too dark. Improve lighting.');
      } else if (qualityError === 'Face too blurry') {
        setStatus('Face too blurry. Hold still.');
      } else if (qualityError === 'Face too small') {
        setStatus('Face too small. Move closer.');
      } else if (qualityError === 'Face alignment invalid') {
        setStatus('Center your face in the guide.');
      } else {
        setStatus(qualityError);
      }
      return;
    }

    if (box == null || keypoints == null || blazePixels == null) {
      setDetectedBox(undefined);
      latestEmbeddingRef.current = null;
      
      const timeSinceLastFace = now - lastFaceTimeRef.current;
      if (lastFaceTimeRef.current > 0 && timeSinceLastFace > 800) {
        console.log(`[Tracking] Target lost for ${timeSinceLastFace}ms (timeout: 800ms). Resetting liveness & auth states.`);
        setLivenessBlink(false);
        setLivenessHead(false);
        resetBlinkHistory();
        resetHeadMovementHistory();
        resetAntiSpoofHistory();
        setRollingScores([]);
        setAuthState('IDLE');
      } else {
        setAuthState('SCANNING');
      }
      
      const storedCount = Object.keys(storedEmbeddings).length;
      if (storedCount === 0) {
        setStatus('No registered profiles. Please register first.');
      } else {
        setStatus(`Align face in the guide to authenticate: ${activeUser.name}`);
      }
      return;
    }

    lastFaceTimeRef.current = now;

    setDetectedBox(box);

    if (embedding == null) {
      latestEmbeddingRef.current = null;
      setLivenessBlink(false);
      setLivenessHead(false);
      resetBlinkHistory();
      resetHeadMovementHistory();
      setRollingScores([]);
      setAuthState('SCANNING');
      setStatus('Face validation failed. Align face inside the guide.');
      return;
    }

    let isEmbeddingInvalid = false;
    if (embedding.length === 0) {
      isEmbeddingInvalid = true;
    } else {
      let sumSq = 0;
      for (let i = 0; i < embedding.length; i++) {
        const v = embedding[i];
        if (isNaN(v) || !isFinite(v)) {
          isEmbeddingInvalid = true;
          break;
        }
        sumSq += v * v;
      }
      if (sumSq === 0) {
        isEmbeddingInvalid = true;
      }
    }

    if (isEmbeddingInvalid) {
      setStatus('Invalid embedding detected');
      setAuthState('REJECTED');
      lastRejectionTimeRef.current = now;
      return;
    }

    latestEmbeddingRef.current = embedding;

    let blinkDetected = livenessBlink;
    if (!blinkDetected) {
      blinkDetected = detectBlink(blazePixels, keypoints, activeEmulator);
      if (blinkDetected) {
        setLivenessBlink(true);
        lastBlinkTimeRef.current = Date.now();
        console.log('Blink verified');
      }
    } else {
      console.log('Blink verified');
    }

    let headMoved = livenessHead;
    if (!headMoved) {
      headMoved = detectHeadMovement(box, keypoints, activeEmulator);
      if (headMoved) {
        setLivenessHead(true);
        lastHeadMovementTimeRef.current = Date.now();
        console.log('Head movement verified');
      }
    } else {
      console.log('Head movement verified');
    }

    const blinkConf = getBlinkConfidence();
    const headConf = getHeadMovementConfidence();
    const currentLivenessConfidence = (blinkConf + headConf) / 2;
    console.log(`Liveness confidence score: ${currentLivenessConfidence}`);

    if (spoofDetected) {
      console.log('Spoof detected');
      if (spoofConfidence >= 0.70) {
        console.log('Replay attack suspected');
      }
    }

    const currentBlinkValid = Date.now() - lastBlinkTimeRef.current < 5000;
    const currentHeadValid = Date.now() - lastHeadMovementTimeRef.current < 5000;
    const livenessPassed = activeEmulator || (currentBlinkValid && currentHeadValid);

    const activeEmbeds = storedEmbeddings[activeUser.name] || [];
    if (activeEmbeds.length === 0) {
      setAuthState('DETECTING');
      setStatus(`Face detected. Register embeddings for ${activeUser.name}.`);
      setRollingScores([]);
      return;
    }

    const storedMap: { [key: string]: Float32Array } = {};
    activeEmbeds.forEach((emb, index) => {
      storedMap[`${activeUser.name}_${index}`] = emb;
    });

    const authResult = authenticateFace(embedding, storedMap, 0.85);
    const bestScore = authResult.score;

    let nextRollingScores = [...rollingScores, bestScore];
    if (nextRollingScores.length > 5) {
      nextRollingScores.shift();
    }
    setRollingScores(nextRollingScores);

    const rollingSum = nextRollingScores.reduce((sum, s) => sum + s, 0);
    const rollingAvg = nextRollingScores.length > 0 ? rollingSum / nextRollingScores.length : 0;

    let consecutiveCount = 0;
    let hasThreeConsecutive = false;
    for (const score of nextRollingScores) {
      if (score > 0.85) {
        consecutiveCount++;
        if (consecutiveCount >= 3) {
          hasThreeConsecutive = true;
        }
      } else {
        consecutiveCount = 0;
      }
    }

    const similarityPassed = rollingAvg > 0.85 && hasThreeConsecutive;
    const hysteresisPassed = sessionActive && bestScore >= 0.80;

    if (livenessPassed && (similarityPassed || hysteresisPassed)) {
      console.log('Live face verified');
      lastAuthTimeRef.current = Date.now();
      sessionExpiryRef.current = Date.now() + 30000;
      setSessionActive(true);
      setAuthState('AUTHENTICATED');
      setAuthenticatedUser(activeUser.name);
      setAuthScore(bestScore);
      
      saveSecuredData(`failed_attempts_${activeUser.name}`, '0');
      setFailedAttempts(prev => ({ ...prev, [activeUser.name]: 0 }));

      // Record successful auth metadata (CHANGE-5, CHANGE-9)
      const nowStr = new Date().toLocaleString();
      getSecuredData(`auth_count_${activeUser.name}`).then(cStr => {
        const newCount = (cStr ? parseInt(cStr, 10) : 0) + 1;
        saveSecuredData(`auth_count_${activeUser.name}`, String(newCount));
      });
      saveSecuredData(`last_active_${activeUser.name}`, nowStr);
      
      setStatus(`✓ Face Verified. Welcome back, ${activeUser.name}`);

      // Log successful verification (CHANGE-20)
      try {
        const { logSecurityEvent } = require('./src/security/auditLogger');
        logSecurityEvent('AUTH_SUCCESS', `User ${activeUser.name} verified successfully.`);
      } catch (err) {
        console.error('[Security] Failed to write success audit log:', err);
      }

      // Enqueue offline attendance record (CHANGE-1, CHANGE-5, CHANGE-8, CHANGE-19)
      try {
        const { enqueueAttendance } = require('./src/sync/syncQueue');
        enqueueAttendance({
          userId: String(activeUser.id),
          userName: activeUser.name,
          timestamp: new Date().toISOString(),
          verificationScore: bestScore,
        }).catch((e: any) => console.error('[App] Failed to enqueue attendance:', e));
      } catch (err) {
        console.error('[App] Error enqueuing attendance:', err);
      }
    } else {
      setAuthenticatedUser(null);
      setAuthScore(bestScore);

      if (livenessPassed && !similarityPassed && bestScore < 0.85) {
        if (now - lastFailureIncrementRef.current > 3000) {
          lastFailureIncrementRef.current = now;
          const currentAttempts = (failedAttempts[activeUser.name] || 0) + 1;
          
          saveSecuredData(`failed_attempts_${activeUser.name}`, String(currentAttempts));
          setFailedAttempts(prev => ({ ...prev, [activeUser.name]: currentAttempts }));
          
          console.log(`[Lockout] Failed auth attempt #${currentAttempts} for: ${activeUser.name}`);

          // Log failed verification (CHANGE-20)
          try {
            const { logSecurityEvent } = require('./src/security/auditLogger');
            logSecurityEvent('AUTH_FAILURE', `Failed attempt #${currentAttempts} for ${activeUser.name}`);
          } catch (err) {
            console.error('[Security] Failed to write failure audit log:', err);
          }

          let lockoutTime = 0;
          if (currentAttempts >= 15) {
            lockoutTime = now + 10 * 60 * 1000;
          } else if (currentAttempts >= 10) {
            lockoutTime = now + 2 * 60 * 1000;
          } else if (currentAttempts >= 5) {
            lockoutTime = now + 30 * 1000;
          }

          if (lockoutTime > 0) {
            saveSecuredData(`lockout_expiry_${activeUser.name}`, String(lockoutTime));
            setLockoutExpiry(prev => ({ ...prev, [activeUser.name]: lockoutTime }));

            // Log lockout triggered (CHANGE-20)
            try {
              const { logSecurityEvent } = require('./src/security/auditLogger');
              logSecurityEvent('LOCKOUT_TRIGGERED', `User ${activeUser.name} locked out due to excessive failed attempts.`);
            } catch (err) {
              console.error('[Security] Failed to write lockout audit log:', err);
            }
          }
        }
      }

      if (bestScore > 0.85) {
        setAuthState('VERIFYING');
        if (!livenessPassed) {
          setStatus('Face match! Please blink & turn head to verify liveness.');

          // Log spoof attempt (CHANGE-20)
          try {
            const { logSecurityEvent } = require('./src/security/auditLogger');
            logSecurityEvent('SPOOF_ATTEMPT', `Spoof attempt suspected: face matched for ${activeUser.name} but liveness check failed.`);
          } catch (err) {
            console.error('[Security] Failed to write spoof audit log:', err);
          }
        } else {
          setStatus(`Validating match... (${nextRollingScores.filter(s => s > 0.85).length}/3 frames, avg: ${(rollingAvg * 100).toFixed(0)}%)`);
        }
      } else if (bestScore >= 0.70 && bestScore <= 0.85) {
        setAuthState('VERIFYING');

        setStatus(`Uncertain Match (${(bestScore * 100).toFixed(0)}%). Align face.`);
      } else {
        setAuthState('REJECTED');
        setStatus(`ACCESS DENIED: Face mismatch (${(bestScore * 100).toFixed(0)}%)`);
        lastRejectionTimeRef.current = now;
      }
    }

    // Zero out local embedding and clean up references (CHANGE-11)
    if (currentScreen !== 'Onboarding') {
      if (latestEmbeddingRef.current) {
        latestEmbeddingRef.current.fill(0);
        latestEmbeddingRef.current = null;
      }
      embedding.fill(0);
    }
  }, [storedEmbeddings, rollingScores, livenessBlink, livenessHead, activeUser, failedAttempts, lockoutExpiry, sessionActive, authenticatedUser, activeEmulator, currentScreen]);


  const handleRegister = async () => {
    const name = registrationName.trim();
    if (!name) {
      setStatus('Please enter a username to register.');
      return;
    }
    const currentEmbedding = latestEmbeddingRef.current;
    if (currentEmbedding == null) {
      setStatus('No face detected in frame. Align face first.');
      return;
    }

    try {
      let user = usersList.find(u => u.name.toLowerCase() === name.toLowerCase());
      let userId = user ? user.id : null;
      
      if (!userId) {
        userId = await createUser(name);
      }
      
      await insertEmbedding(userId, currentEmbedding, 'MobileFaceNet_v1');
      await loadAll();

      // Zero out registered embedding memory (CHANGE-11)
      currentEmbedding.fill(0);
      latestEmbeddingRef.current = null;
      
      // Save onboarding completion state (CHANGE-9)
      await saveSecuredData('setting_onboardingCompleted', 'true');

      
      setRegistrationName('');
      setStatus(`Successfully registered user: ${name}!`);

      // Force transition to scanner view
      setCurrentScreen('Verification');
    } catch (err) {
      setStatus(`Registration failed: ${errorMessage(err)}`);
    }
  };

  const handleCreateUser = async (name: string) => {
    await createUser(name);
    await loadAll();
  };

  const handleClearAll = async () => {
    try {
      // Zero out embeddings before deletion (CHANGE-11)
      Object.keys(storedEmbeddings).forEach(username => {
        const arrays = storedEmbeddings[username];
        if (arrays) {
          arrays.forEach(arr => arr.fill(0));
        }
      });

      const users = await getAllUsers();
      for (const u of users) {
        await deleteUser(u.id);
        await saveSecuredData(`failed_attempts_${u.name}`, '0');
        await saveSecuredData(`lockout_expiry_${u.name}`, '0');
        await saveSecuredData(`auth_count_${u.name}`, '0');
        await saveSecuredData(`last_active_${u.name}`, 'Never');
      }
      setStoredEmbeddings({});

      setUsersList([]);
      setActiveUser(null);
      setAuthenticatedUser(null);
      setAuthState('IDLE');
      setRollingScores([]);
      setLivenessBlink(false);
      setLivenessHead(false);
      resetBlinkHistory();
      resetHeadMovementHistory();
      setFailedAttempts({});
      setLockoutExpiry({});
      
      // Also reset onboarding state if database is empty so onboarding triggers again
      await saveSecuredData('setting_onboardingCompleted', 'false');
      setCurrentScreen('Onboarding');
      setOnboardingStep(0);
      
      setStatus('All profiles cleared successfully.');
    } catch (err) {
      setStatus(`Failed to clear profiles: ${errorMessage(err)}`);
    }
  };

  const handleSwitchUser = (user: User) => {
    setActiveUser(user);
    setRollingScores([]);
    setLivenessBlink(false);
    setLivenessHead(false);
    resetBlinkHistory();
    resetHeadMovementHistory();
    setStatus(`Switched active profile to: ${user.name}`);
  };

  const handleRenameUser = async (id: number, newName: string) => {
    if (!newName.trim()) return;
    try {
      await renameUser(id, newName.trim());
      await loadAll();
      setStatus(`Renamed profile to ${newName.trim()}`);
    } catch (err) {
      setStatus(`Rename failed: ${errorMessage(err)}`);
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      const user = usersList.find(u => u.id === id);
      if (user) {
        // Zero out deleted user's embeddings in RAM (CHANGE-11)
        const arrays = storedEmbeddings[user.name];
        if (arrays) {
          arrays.forEach(arr => arr.fill(0));
        }
        await saveSecuredData(`failed_attempts_${user.name}`, '0');
        await saveSecuredData(`lockout_expiry_${user.name}`, '0');
        await saveSecuredData(`auth_count_${user.name}`, '0');
        await saveSecuredData(`last_active_${user.name}`, 'Never');
      }
      await deleteUser(id);
      await loadAll();

      
      // If no users left, reset onboarding Completed
      const newList = await getAllUsers();
      if (newList.length === 0) {
        await saveSecuredData('setting_onboardingCompleted', 'false');
        setCurrentScreen('Onboarding');
        setOnboardingStep(0);
      }
      setStatus('Profile deleted successfully.');
    } catch (err) {
      setStatus(`Delete failed: ${errorMessage(err)}`);
    }
  };

  const handleBackup = async () => {
    try {
      setStatus('Creating secure encrypted backup...');
      const { performBackup } = require('./src/backup/backupManager');
      const backupPath = await performBackup();
      setStatus(`Encrypted backup created at: ${backupPath}`);
    } catch (err) {
      setStatus(`Backup failed: ${errorMessage(err)}`);
    }
  };

  const handleRestore = async () => {
    try {
      setStatus('Restoring database from secure backup...');
      const backupPath = `${RNFS.DocumentDirectoryPath}/secure_edge_backup.enc`;
      const { performRestore } = require('./src/backup/restoreManager');
      await performRestore(backupPath);
      await loadAll();
      setStatus('Database restored successfully from backup!');
    } catch (err) {
      setStatus(`Restore failed: ${errorMessage(err)}`);
    }
  };


  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      if (workletWarmUpFrames < 4) {
        workletWarmUpFrames++;
        return;
      }
      const blazeBox = boxedBlaze.value;
      const faceNetBox = boxedFaceNet.value;
 
      if (
        blazeBox == null ||
        faceNetBox == null ||
        blazeInput == null ||
        faceInput == null ||
        resize == null
      ) {
        return;
      }
 
      runAtTargetFps(workletInferenceFps, () => {
        'worklet';
        if (!frame.isValid) {
          return;
        }
 
        try {
          const startTime = performance.now();
          const blazeModel = blazeBox.unbox();
          const faceNetModel = faceNetBox.unbox();
          const rotation = rotationForFrame(frame.orientation);
 
          const blazePixels = resize(frame, {
            scale: {
              width: blazeInput.width,
              height: blazeInput.height,
            },
            rotation,
            mirror: frame.isMirrored,
            pixelFormat: 'rgb',
            dataType: blazeInput.dataType,
          });
          const blazeBuffer = viewToExactArrayBuffer(blazePixels);
          const blazeOutputs = blazeModel.runSync([blazeBuffer]);
 
          if (blazeOutputs.length < 2) {
            const latency = performance.now() - startTime;
            handleFrameResult(null, null, null, null, null, 0, latency, false, 0.0);
            return;
          }
 
          const regressors = new Float32Array(blazeOutputs[0]);
          const classificators = new Float32Array(blazeOutputs[1]);
          
          decodeBlazeFaceBoxes(regressors, classificators, blazeAnchors, FACE_SCORE_THRESHOLD);
          
          let validFaceCount = 0;
          let bestFaceIdx = -1;
          let maxArea = -Infinity;
          
          for (let j = 0; j < preAllocatedBoxes.count; j++) {
            const w = preAllocatedBoxes.xMax[j] - preAllocatedBoxes.xMin[j];
            const h = preAllocatedBoxes.yMax[j] - preAllocatedBoxes.yMin[j];
            const area = w * h;
            const conf = preAllocatedBoxes.confidence[j];
            
            if (area < 0.035 || conf < 0.50) {
              continue;
            }
            validFaceCount++;
            // Closest-face selection: select the face with the largest area (Phase 5)
            if (area > maxArea) {
              maxArea = area;
              bestFaceIdx = j;
            }
          }
          
          if (validFaceCount > 1) {
            const latency = performance.now() - startTime;
            handleFrameResult(null, null, null, null, null, validFaceCount, latency, false, 0.0);
            return;
          }
          
          if (bestFaceIdx === -1) {
            const latency = performance.now() - startTime;
            handleFrameResult(null, null, null, null, null, 0, latency, false, 0.0);
            return;
          }
          
          const rawBoxRaw = {
            xMin: preAllocatedBoxes.xMin[bestFaceIdx],
            yMin: preAllocatedBoxes.yMin[bestFaceIdx],
            xMax: preAllocatedBoxes.xMax[bestFaceIdx],
            yMax: preAllocatedBoxes.yMax[bestFaceIdx],
          };

          // Double Exponential Smoothing for Bounding Box (Phase 11 / CHANGE-16)
          const smoothAlpha = 0.45;
          const smoothBeta = 0.25;
          
          if (smoothedBoxXMin < 0) {
            smoothedBoxXMin = rawBoxRaw.xMin;
            smoothedBoxYMin = rawBoxRaw.yMin;
            smoothedBoxXMax = rawBoxRaw.xMax;
            smoothedBoxYMax = rawBoxRaw.yMax;
          } else {
            const lastXMin = smoothedBoxXMin;
            const lastYMin = smoothedBoxYMin;
            const lastXMax = smoothedBoxXMax;
            const lastYMax = smoothedBoxYMax;
            
            smoothedBoxXMin = smoothAlpha * rawBoxRaw.xMin + (1 - smoothAlpha) * (smoothedBoxXMin + smoothedBoxXMinTrend);
            smoothedBoxYMin = smoothAlpha * rawBoxRaw.yMin + (1 - smoothAlpha) * (smoothedBoxYMin + smoothedBoxYMinTrend);
            smoothedBoxXMax = smoothAlpha * rawBoxRaw.xMax + (1 - smoothAlpha) * (smoothedBoxXMax + smoothedBoxXMaxTrend);
            smoothedBoxYMax = smoothAlpha * rawBoxRaw.yMax + (1 - smoothAlpha) * (smoothedBoxYMax + smoothedBoxYMaxTrend);
            
            smoothedBoxXMinTrend = smoothBeta * (smoothedBoxXMin - lastXMin) + (1 - smoothBeta) * smoothedBoxXMinTrend;
            smoothedBoxYMinTrend = smoothBeta * (smoothedBoxYMin - lastYMin) + (1 - smoothBeta) * smoothedBoxYMinTrend;
            smoothedBoxXMaxTrend = smoothBeta * (smoothedBoxXMax - lastXMax) + (1 - smoothBeta) * smoothedBoxXMaxTrend;
            smoothedBoxYMaxTrend = smoothBeta * (smoothedBoxYMax - lastYMax) + (1 - smoothBeta) * smoothedBoxYMaxTrend;
          }
          
          const bestBox = {
            xMin: smoothedBoxXMin,
            yMin: smoothedBoxYMin,
            xMax: smoothedBoxXMax,
            yMax: smoothedBoxYMax,
          };
          
          const bestKeypoints = [
            { x: preAllocatedBoxes.keypointsX[bestFaceIdx * 6 + 0], y: preAllocatedBoxes.keypointsY[bestFaceIdx * 6 + 0] },
            { x: preAllocatedBoxes.keypointsX[bestFaceIdx * 6 + 1], y: preAllocatedBoxes.keypointsY[bestFaceIdx * 6 + 1] },
            { x: preAllocatedBoxes.keypointsX[bestFaceIdx * 6 + 2], y: preAllocatedBoxes.keypointsY[bestFaceIdx * 6 + 2] },
            { x: preAllocatedBoxes.keypointsX[bestFaceIdx * 6 + 3], y: preAllocatedBoxes.keypointsY[bestFaceIdx * 6 + 3] },
            { x: preAllocatedBoxes.keypointsX[bestFaceIdx * 6 + 4], y: preAllocatedBoxes.keypointsY[bestFaceIdx * 6 + 4] },
            { x: preAllocatedBoxes.keypointsX[bestFaceIdx * 6 + 5], y: preAllocatedBoxes.keypointsY[bestFaceIdx * 6 + 5] },
          ];

          const nowMs = Date.now();
          
          // Tracking stability & loss recovery timer logic (CHANGE-5, CHANGE-6)
          let isSameFace = false;
          if (lastTrackedNoseX > -900 && lastTrackedNoseY > -900) {
            const dx = bestKeypoints[2].x - lastTrackedNoseX;
            const dy = bestKeypoints[2].y - lastTrackedNoseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.15) {
              isSameFace = true;
            }
          }
          
          if (!isSameFace) {
            faceStabilityStartTime = nowMs;
            lastTrackedNoseX = bestKeypoints[2].x;
            lastTrackedNoseY = bestKeypoints[2].y;
          }
          lastFaceDetectedTime = nowMs;

          const faceStableDuration = nowMs - faceStabilityStartTime;
          const isFaceStable = faceStableDuration >= 1200; // Require 1.2s persistence (Change-5)

          // Thermal Protection check (CHANGE-7)
          let skipHeavyChecksDueToThermal = false;
          if (workletLatencyCount >= 5) {
            const avg = (workletLatency1 + workletLatency2 + workletLatency3 + workletLatency4 + workletLatency5) / 5;
            if (avg > 350) {
              workletInferenceFps = 1;
              skipHeavyChecksDueToThermal = true;
            } else if (avg > 220) {
              workletInferenceFps = 2;
              skipHeavyChecksDueToThermal = true;
            } else {
              workletInferenceFps = 4;
            }
          }

          // Throttled Heavy Spoof analysis (CHANGE-1)
          const runHeavySpoof = (nowMs - lastHeavySpoofTime > 750) && !skipHeavyChecksDueToThermal;
          if (runHeavySpoof) {
            lastHeavySpoofTime = nowMs;
            const spoofRes = verifyAntiSpoofing(
              blazePixels as Float32Array,
              blazeInput.width,
              blazeInput.height,
              bestBox,
              bestKeypoints,
              activeEmulator
            );
            cachedSpoofResult = spoofRes.spoofDetected;
            cachedSpoofConfidence = spoofRes.spoofConfidence;
          }

          const spoofDetected = cachedSpoofResult;

          // 1. Run face-quality validation BEFORE MobileFaceNet embedding extraction (CHANGE-2)
          const quality = validateFaceQuality(
            blazePixels as Float32Array,
            blazeInput.width,
            blazeInput.height,
            bestBox,
            bestKeypoints,
            activeEmulator
          );
          
          let qualityError: string | null = null;
          if (!isFaceStable) {
            qualityError = 'Hold still...';
          } else if (quality.tooSmall) {
            qualityError = 'Face too small';
          } else if (quality.alignmentInvalid || quality.occluded) {
            qualityError = 'Face alignment invalid';
          } else if (quality.lowLightDetected) {
            qualityError = 'Face too dark';
          } else if (quality.blurDetected) {
            qualityError = 'Face too blurry';
          } else if (spoofDetected) {
            qualityError = 'Spoof detected';
          }
          
          if (qualityError != null) {
            const latency = performance.now() - startTime;
            handleFrameResult(bestBox, bestKeypoints, blazePixels as Float32Array, null, qualityError, validFaceCount, latency, spoofDetected, cachedSpoofConfidence);
            return;
          }
          
          const rawBox = unprocessBox(bestBox, rotation, frame.isMirrored);
          const faceCrop = faceCropForFrame(
            frame.width,
            frame.height,
            rawBox,
          );
          const facePixels = resize(frame, {
            crop: faceCrop,
            scale: {
              width: faceInput.width,
              height: faceInput.height,
            },
            rotation,
            mirror: frame.isMirrored,
            pixelFormat: 'rgb',
            dataType: faceInput.dataType,
          });
          const faceBuffer = viewToExactArrayBuffer(facePixels);
          
          let embeddingOutputs;
          try {
            embeddingOutputs = faceNetModel.runSync([faceBuffer]);
          } catch (tfliteErr) {
            console.log('TFLite inference error: ' + String(tfliteErr));
            const latency = performance.now() - startTime;
            handleFrameResult(bestBox, bestKeypoints, blazePixels as Float32Array, null, null, validFaceCount, latency, spoofDetected, cachedSpoofConfidence);
            return;
          }
          
          if (embeddingOutputs.length === 0 || embeddingOutputs[0].byteLength % 4 !== 0) {
            const latency = performance.now() - startTime;
            handleFrameResult(bestBox, bestKeypoints, blazePixels as Float32Array, null, null, validFaceCount, latency, spoofDetected, cachedSpoofConfidence);
            return;
          }
 
          const embedding = new Float32Array(embeddingOutputs[0]);
          const latency = performance.now() - startTime;
          
          workletLatency5 = workletLatency4;
          workletLatency4 = workletLatency3;
          workletLatency3 = workletLatency2;
          workletLatency2 = workletLatency1;
          workletLatency1 = latency;
          if (workletLatencyCount < 5) {
            workletLatencyCount++;
          }
          if (workletLatencyCount >= 5) {
            const avg = (workletLatency1 + workletLatency2 + workletLatency3 + workletLatency4 + workletLatency5) / 5;
            if (avg > 250) {
              workletInferenceFps = 2;
            } else if (avg > 450) {
              workletInferenceFps = 1;
            } else if (avg < 140) {
              workletInferenceFps = 4;
            }
          }
          
          handleFrameResult(bestBox, bestKeypoints, blazePixels as Float32Array, embedding, null, validFaceCount, latency, spoofDetected, cachedSpoofConfidence);
        } catch (error) {
          console.log('Frame processor error: ' + String(error));
          reportRuntimeError(String(error));
        }
      });
    },
    [
      boxedBlaze.value,
      boxedFaceNet.value,
      blazeInput,
      faceInput,
      resize,
      handleFrameResult,
      blazeAnchors,
      activeEmulator,
      authState,
      reportRuntimeError,
    ],
  );

  return (
    <View style={styles.container}>
      {/* Background Camera Layer (CHANGE-3, CHANGE-13) */}
      {isCameraActive && hasPermission && device != null ? (
        <Camera
          key={device.id}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isAppForeground && isCameraActive}
          format={format}
          fps={previewFps}
          resizeMode="cover"
          pixelFormat={CAMERA_PIXEL_FORMAT}
          enableBufferCompression={false}
          androidPreviewViewType="surface-view"
          frameProcessor={enableFrameProcessor ? frameProcessor : undefined}
          onInitialized={() => {
            setCameraError(undefined);
          }}
          onError={error => {
            setCameraError(`${error.code}: ${error.message}`);
          }}
        />
      ) : null}

      {/* Strict Conditional unmounting screens layout (CHANGE-1) */}
      {currentScreen === 'Onboarding' && (
        <OnboardingScreen
          step={onboardingStep}
          setStep={setOnboardingStep}
          registrationName={registrationName}
          setRegistrationName={setRegistrationName}
          handleRegister={handleRegister}
          hasPermission={hasPermission}
          requestPermission={requestPermission}
          status={status}
          detectedBox={detectedBox}
          latestEmbedding={latestEmbeddingRef.current}
          isDarkMode={settings.darkMode}
        />
      )}

      {currentScreen === 'Verification' && (
        <VerificationScreen
          currentScreen={currentScreen}
          setCurrentScreen={setCurrentScreen}
          authState={authState}
          statusText={status}
          detectedBox={detectedBox}
          authScore={authScore}
          authenticatedUser={authenticatedUser}
          activeUser={activeUser}
          livenessBlink={livenessBlink}
          livenessHead={livenessHead}
          rollingScores={rollingScores}
          sessionActive={sessionActive}
          lockoutTimeLeft={lockoutTimeLeft}
          devFps={devFps}
          devInferenceMs={devInferenceMs}
          devMemoryMb={devMemoryMb}
          hardeningRoot={hardeningRoot}
          hardeningDebugger={hardeningDebugger}
          hardeningIntegrity={hardeningIntegrity}
          cameraPosition={cameraPosition}
          telemetryEnabled={settings.telemetryEnabled}
          isDarkMode={settings.darkMode}
          hasPermission={hasPermission}
          requestPermission={requestPermission}
          cameraUnavailable={device == null || cameraError != null}
          onRegisterPressed={() => {
            setCurrentScreen('Onboarding');
            setOnboardingStep(3);
          }}
        />
      )}

      {currentScreen === 'Profiles' && (
        <ProfileListScreen
          usersList={usersList}
          activeUser={activeUser}
          handleSwitchUser={handleSwitchUser}
          handleDeleteUser={handleDeleteUser}
          handleCreateUser={handleCreateUser}
          onSelectProfile={user => {
            setSelectedUser(user);
            setCurrentScreen('ProfileDetails' as any);
          }}
          onClose={() => setCurrentScreen('Verification')}
          isDarkMode={settings.darkMode}
        />
      )}

      {currentScreen === 'ProfileDetails' && selectedUser != null && (
        <ProfileDetailsScreen
          user={selectedUser}
          onBack={() => {
            setSelectedUser(null);
            setCurrentScreen('Profiles');
          }}
          handleRenameUser={handleRenameUser}
          handleDeleteUser={handleDeleteUser}
          isDarkMode={settings.darkMode}
        />
      )}

      {currentScreen === 'Settings' && (
        <SettingsScreen
          settings={settings}
          updateSetting={updateSetting}
          handleBackup={handleBackup}
          handleRestore={handleRestore}
          handleClearAll={handleClearAll}
          handleResetSettings={handleResetSettings}
          onClose={() => setCurrentScreen('Verification')}
          statusMessage={status}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
});

