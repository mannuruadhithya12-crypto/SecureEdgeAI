import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';
import {
  Camera,
  type CameraPosition,
  runAtTargetFps,
  Templates,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import {
  type Tensor,
  type TensorflowModelDelegate,
  type TfliteModel,
  useTensorflowModel,
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
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  loadEmbeddings,
  deleteEmbedding,
} from './src/services/embeddingStorage';
import { detectBlink, resetBlinkHistory } from './src/liveness/blinkDetection';
import { detectHeadMovement, resetHeadMovementHistory } from './src/liveness/headMovement';
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
} from './src/security/secureStorage';
import {
  float32ArrayToBase64,
  base64ToFloat32Array,
} from './src/utils/serialization';
import {
  isRooted,
  isDebuggerPresent,
  checkApkIntegrity,
} from './src/security/deviceHardening';
import RNFS from 'react-native-fs';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BLAZEFACE_FRONT_MODEL = require('./src/assets/models/blazeface_front.tflite');
const BLAZEFACE_BACK_MODEL = require('./src/assets/models/blazeface_back.tflite');
const MOBILEFACENET_MODEL = require('./src/assets/models/mobilefacenet.tflite');

const CPU_DELEGATES: TensorflowModelDelegate[] = [];
const FACE_SCORE_THRESHOLD = 0.45;
/** RGB avoids corrupt YUV preview on many Android emulators; matches frame-processor resize. */
const CAMERA_PIXEL_FORMAT = 'rgb' as const;
const INFERENCE_FPS = 4;
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

function decodeBlazeFaceBox(
  regressors: Float32Array,
  classificators: Float32Array,
  anchors: Float32Array,
  scoreThreshold: number
): { box?: NormalizedBox; confidence: number; keypoints?: Keypoint[] } {
  'worklet';
  
  let bestScore = -Infinity;
  let bestIdx = -1;
  
  for (let i = 0; i < 896; i++) {
    const rawScore = classificators[i];
    // Sigmoid function
    const score = 1 / (1 + Math.exp(-rawScore));
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  
  if (bestIdx === -1 || bestScore < scoreThreshold) {
    return { confidence: bestScore };
  }
  
  const i = bestIdx;
  const x_center_anchor = anchors[i * 4 + 0];
  const y_center_anchor = anchors[i * 4 + 1];
  const w_anchor = anchors[i * 4 + 2];
  const h_anchor = anchors[i * 4 + 3];
  
  const dx = regressors[i * 16 + 0] / 128.0;
  const dy = regressors[i * 16 + 1] / 128.0;
  const dw = regressors[i * 16 + 2] / 128.0;
  const dh = regressors[i * 16 + 3] / 128.0;
  
  const x_center = x_center_anchor + dx * w_anchor;
  const y_center = y_center_anchor + dy * h_anchor;
  const w = dw * w_anchor;
  const h = dh * h_anchor;
  
  const xMin = x_center - w / 2;
  const yMin = y_center - h / 2;
  const xMax = x_center + w / 2;
  const yMax = y_center + h / 2;

  const keypoints: Keypoint[] = [];
  for (let k = 0; k < 6; k++) {
    const kx_reg = regressors[i * 16 + 4 + k * 2] / 128.0;
    const ky_reg = regressors[i * 16 + 4 + k * 2 + 1] / 128.0;
    const kx = x_center_anchor + kx_reg * w_anchor;
    const ky = y_center_anchor + ky_reg * h_anchor;
    keypoints.push({
      x: Math.max(0, Math.min(1, kx)),
      y: Math.max(0, Math.min(1, ky)),
    });
  }
  
  return {
    box: {
      xMin: Math.max(0, Math.min(1, xMin)),
      yMin: Math.max(0, Math.min(1, yMin)),
      xMax: Math.max(0, Math.min(1, xMax)),
      yMax: Math.max(0, Math.min(1, yMax)),
    },
    confidence: bestScore,
    keypoints,
  };
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



type AuthState = 'IDLE' | 'SCANNING' | 'DETECTING' | 'VERIFYING' | 'AUTHENTICATED' | 'REJECTED';

function MainApp() {
  const isEmulator = useMemo(() => isAndroidEmulator(), []);
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>('front');
  const device = useCameraDevice(cameraPosition);
  const format = useCameraFormat(device, [
    ...Templates.FrameProcessing,
    { videoAspectRatio: SCREEN_WIDTH / Dimensions.get('window').height },
  ]);
  const { hasPermission, requestPermission } = useCameraPermission();
  const permissionRequestedRef = useRef(false);

  const [permissionError, setPermissionError] = useState<string>();
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
  const [livenessStatus, setLivenessStatus] = useState('Blink: ❌ | Head: ❌');
  const [authScore, setAuthScore] = useState(0);
  const [authenticatedUser, setAuthenticatedUser] = useState<string | null>(null);
  const [rollingScores, setRollingScores] = useState<number[]>([]);
  
  const [registeredUserSuccess, setRegisteredUserSuccess] = useState<string | null>(null);
  const lastBlinkTimeRef = useRef<number>(0);
  const lastHeadMovementTimeRef = useRef<number>(0);
  const lastAuthTimeRef = useRef<number>(0);
  
  // Hardening and Lockout States
  const [failedAttempts, setFailedAttempts] = useState<{ [username: string]: number }>({});
  const [lockoutExpiry, setLockoutExpiry] = useState<{ [username: string]: number }>({});
  const [sessionActive, setSessionActive] = useState(false);
  const sessionExpiryRef = useRef<number>(0);
  const lastFailureIncrementRef = useRef<number>(0);
  
  // Security Indicators
  const [hardeningRoot, setHardeningRoot] = useState(false);
  const [hardeningDebugger, setHardeningDebugger] = useState(false);
  const [hardeningIntegrity, setHardeningIntegrity] = useState(true);
  
  const latestEmbeddingRef = useRef<Float32Array | null>(null);
  const [detectedBox, setDetectedBox] = useState<NormalizedBox | undefined>();
  const blazeAnchors = useMemo(() => generateBlazeFaceAnchors(), []);

  const blazeFront = useTensorflowModel(BLAZEFACE_FRONT_MODEL, CPU_DELEGATES);
  const blazeBack = useTensorflowModel(BLAZEFACE_BACK_MODEL, CPU_DELEGATES);
  const mobileFaceNet = useTensorflowModel(MOBILEFACENET_MODEL, CPU_DELEGATES);
  const { resize, error: resizeError } = useSafeResizePlugin();

  const blazeFrontModel = blazeFront.state === 'loaded' ? blazeFront.model : undefined;
  const blazeBackModel = blazeBack.state === 'loaded' ? blazeBack.model : undefined;
  const mobileFaceNetModel =
    mobileFaceNet.state === 'loaded' ? mobileFaceNet.model : undefined;

  const activeBlazeModel =
    device?.position === 'back' ? blazeBackModel ?? blazeFrontModel : blazeFrontModel;

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

  const loadAll = async () => {
    try {
      // 1. JSON-to-SQLite Migration (Change 10 / Task 6)
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
          console.log('Migration completed');
          dbUsers = await getAllUsers();
        }
      }

      setUsersList(dbUsers);

      // 2. Load embeddings into memory cache (Change 4)
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

      // 3. Set/Select active user (Task 15)
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

  useEffect(() => {
    const initializeApp = async () => {
      // Run security hardening checks (Task 17, 18, 20 / Change 6)
      const rooted = await isRooted();
      const debuggerConnected = await isDebuggerPresent();
      const integrityPassed = await checkApkIntegrity();
      
      setHardeningRoot(rooted);
      setHardeningDebugger(debuggerConnected);
      setHardeningIntegrity(integrityPassed);

      await loadAll();
    };

    initializeApp();
  }, []);

  useEffect(() => {
    if (!hasPermission && !permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      requestPermission()
        .then(granted => {
          if (!granted) {
            setPermissionError('Camera permission was denied');
          }
        })
        .catch(error => {
          setPermissionError(errorMessage(error));
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

  // JS callback to handle the frame processor results asynchronously
  const handleFrameResult = useRunOnJS((
    box: NormalizedBox | null,
    keypoints: Keypoint[] | null,
    blazePixels: Float32Array | null,
    embedding: Float32Array | null
  ) => {
    const now = Date.now();

    // 1. Session system auto-expiration & extension (Task 21 / Change 5)
    if (sessionActive) {
      if (now < sessionExpiryRef.current) {
        // Active user still verified
        setAuthState('AUTHENTICATED');
        const secondsLeft = Math.ceil((sessionExpiryRef.current - now) / 1000);
        setStatus(`Session Active (${secondsLeft}s left): ${activeUser?.name}`);
        return;
      } else {
        // Session expired
        setSessionActive(false);
        setAuthState('IDLE');
        setAuthenticatedUser(null);
        setStatus('Session expired. Align face to re-authenticate.');
      }
    }

    if (now - lastAuthTimeRef.current < 3000) {
      // Keep authenticated UI state and do not run matching/liveness during post-auth cooldown
      setAuthState('AUTHENTICATED');
      return;
    }

    if (activeUser == null) {
      setAuthState('IDLE');
      setStatus('No active profile. Select or register a profile.');
      setDetectedBox(undefined);
      return;
    }

    // 2. Active User Lockout Check (Task 23 / Change 9)
    const userLockout = lockoutExpiry[activeUser.name] || 0;
    if (now < userLockout) {
      const secondsLeft = Math.ceil((userLockout - now) / 1000);
      setAuthState('REJECTED');
      setStatus(`ACCESS DENIED: ${activeUser.name} is locked out. Try again in ${secondsLeft}s.`);
      setDetectedBox(box || undefined);
      return;
    }

    if (box == null || keypoints == null || blazePixels == null) {
      setDetectedBox(undefined);
      latestEmbeddingRef.current = null;
      setLivenessBlink(false);
      setLivenessHead(false);
      resetBlinkHistory();
      resetHeadMovementHistory();
      setRollingScores([]);
      setAuthState('IDLE');
      
      const storedCount = Object.keys(storedEmbeddings).length;
      if (storedCount === 0) {
        setStatus('No registered profiles. Please register first.');
      } else {
        setStatus(`Align face in the guide to authenticate: ${activeUser.name}`);
      }
      setLivenessStatus('Blink: ❌ | Head: ❌');
      return;
    }

    setDetectedBox(box);

    if (embedding == null) {
      latestEmbeddingRef.current = null;
      setLivenessBlink(false);
      setLivenessHead(false);
      resetBlinkHistory();
      resetHeadMovementHistory();
      setRollingScores([]);
      setAuthState('SCANNING');
      setStatus('Face too small or off-center. Align face inside the guide.');
      setLivenessStatus('Blink: ❌ | Head: ❌');
      return;
    }

    latestEmbeddingRef.current = embedding;

    // 3. Liveness detection checks with 5-second temporal window (Change 5)
    let blinkDetected = livenessBlink;
    if (!blinkDetected) {
      blinkDetected = detectBlink(blazePixels, keypoints);
      if (blinkDetected) {
        setLivenessBlink(true);
        lastBlinkTimeRef.current = Date.now();
      }
    }

    let headMoved = livenessHead;
    if (!headMoved) {
      headMoved = detectHeadMovement(box, keypoints);
      if (headMoved) {
        setLivenessHead(true);
        lastHeadMovementTimeRef.current = Date.now();
      }
    }

    const currentBlinkValid = Date.now() - lastBlinkTimeRef.current < 5000;
    const currentHeadValid = Date.now() - lastHeadMovementTimeRef.current < 5000;
    const livenessPassed = currentBlinkValid && currentHeadValid;
    setLivenessStatus(`Blink: ${currentBlinkValid ? '✅' : '❌'} | Head: ${currentHeadValid ? '✅' : '❌'}`);

    if (livenessPassed) {
      console.log('Liveness verified');
    }

    // Load in-memory active user embeddings cache (Change 4)
    const activeEmbeds = storedEmbeddings[activeUser.name] || [];
    if (activeEmbeds.length === 0) {
      setAuthState('DETECTING');
      setStatus(`Face detected. Register embeddings for ${activeUser.name}.`);
      setRollingScores([]);
      return;
    }

    // 4. Perform Cosine Similarity matching against selected activeUser embeddings (Task 16)
    const storedMap: { [key: string]: Float32Array } = {};
    activeEmbeds.forEach((emb, index) => {
      storedMap[`${activeUser.name}_${index}`] = emb;
    });

    const authResult = authenticateFace(embedding, storedMap, 0.85);
    const bestScore = authResult.score;

    // Update rolling scores buffer (last 5 scores)
    let nextRollingScores = [...rollingScores, bestScore];
    if (nextRollingScores.length > 5) {
      nextRollingScores.shift();
    }
    setRollingScores(nextRollingScores);

    // Multi-frame validation: requires average similarity > 0.85 AND 3 consecutive frames > 0.85 out of last 5
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
    if (similarityPassed) {
      console.log('Multi-frame validation passed');
    }

    // State machine updates and action decision
    if (livenessPassed && similarityPassed) {
      // Succeeded! Reset lockout, create/extend session (Change 5 / Change 9)
      lastAuthTimeRef.current = Date.now();
      sessionExpiryRef.current = Date.now() + 30000; // Reset session timer to 30s activity window
      setSessionActive(true);
      setAuthState('AUTHENTICATED');
      setAuthenticatedUser(activeUser.name);
      setAuthScore(bestScore);
      
      saveSecuredData(`failed_attempts_${activeUser.name}`, '0');
      setFailedAttempts(prev => ({ ...prev, [activeUser.name]: 0 }));
      
      setStatus(`ACCESS GRANTED: ${activeUser.name} (${(bestScore * 100).toFixed(0)}%)`);
    } else {
      setAuthenticatedUser(null);
      setAuthScore(bestScore);

      // Handle Lockout increments (Change 9)
      // Only count as failure if liveness is verified (real user present) but similarity failed
      if (livenessPassed && !similarityPassed && bestScore < 0.85) {
        if (now - lastFailureIncrementRef.current > 3000) {
          lastFailureIncrementRef.current = now;
          const currentAttempts = (failedAttempts[activeUser.name] || 0) + 1;
          
          saveSecuredData(`failed_attempts_${activeUser.name}`, String(currentAttempts));
          setFailedAttempts(prev => ({ ...prev, [activeUser.name]: currentAttempts }));
          
          console.log(`[Lockout] Failed auth attempt #${currentAttempts} for: ${activeUser.name}`);

          let lockoutTime = 0;
          if (currentAttempts >= 15) {
            lockoutTime = now + 10 * 60 * 1000; // 10 minutes lockout
          } else if (currentAttempts >= 10) {
            lockoutTime = now + 2 * 60 * 1000; // 2 minutes lockout
          } else if (currentAttempts >= 5) {
            lockoutTime = now + 30 * 1000; // 30 seconds lockout
          }

          if (lockoutTime > 0) {
            saveSecuredData(`lockout_expiry_${activeUser.name}`, String(lockoutTime));
            setLockoutExpiry(prev => ({ ...prev, [activeUser.name]: lockoutTime }));
          }
        }
      }

      if (bestScore > 0.85) {
        setAuthState('VERIFYING');
        if (!livenessPassed) {
          setStatus('Face match! Please blink & turn head to verify liveness.');
        } else {
          setStatus(`Validating match... (${nextRollingScores.filter(s => s > 0.85).length}/3 frames, avg: ${(rollingAvg * 100).toFixed(0)}%)`);
        }
      } else if (bestScore >= 0.70 && bestScore <= 0.85) {
        setAuthState('VERIFYING');
        setStatus(`Uncertain Match (${(bestScore * 100).toFixed(0)}%). Align face.`);
      } else {
        setAuthState('REJECTED');
        setStatus(`ACCESS DENIED: Face mismatch (${(bestScore * 100).toFixed(0)}%)`);
      }
    }
  }, [storedEmbeddings, rollingScores, livenessBlink, livenessHead, activeUser, failedAttempts, lockoutExpiry, sessionActive]);

  // Handle face registration
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
      // 1. Check if user already exists
      let user = usersList.find(u => u.name.toLowerCase() === name.toLowerCase());
      let userId = user ? user.id : null;
      
      if (!userId) {
        // Create new user in SQLite (Task 14)
        userId = await createUser(name);
      }
      
      // 2. Insert embedding in SQLite (Task 16)
      await insertEmbedding(userId, currentEmbedding, 'MobileFaceNet_v1');
      
      // 3. Reload from database to refresh memory cache (Change 4)
      await loadAll();
      
      setRegistrationName('');
      setStatus(`Successfully registered user: ${name}!`);
      // Trigger registration success UI banner
      setRegisteredUserSuccess(name);
      setTimeout(() => {
        setRegisteredUserSuccess(null);
      }, 3000);
    } catch (err) {
      setStatus(`Registration failed: ${errorMessage(err)}`);
    }
  };

  // Clear all registered users from SQLite
  const handleClearAll = async () => {
    try {
      const users = await getAllUsers();
      for (const u of users) {
        await deleteUser(u.id);
        await saveSecuredData(`failed_attempts_${u.name}`, '0');
        await saveSecuredData(`lockout_expiry_${u.name}`, '0');
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
      setStatus('All database profiles cleared successfully.');
    } catch (err) {
      setStatus(`Failed to clear profiles: ${errorMessage(err)}`);
    }
  };

  // Switch Active User (Task 15)
  const handleSwitchUser = (user: User) => {
    setActiveUser(user);
    setRollingScores([]);
    setLivenessBlink(false);
    setLivenessHead(false);
    resetBlinkHistory();
    resetHeadMovementHistory();
    setStatus(`Switched active profile to: ${user.name}`);
  };

  // Rename Profile (Task 15)
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

  // Delete Profile (Task 15)
  const handleDeleteUser = async (id: number) => {
    try {
      await deleteUser(id);
      await loadAll();
      setStatus('Profile deleted successfully.');
    } catch (err) {
      setStatus(`Delete failed: ${errorMessage(err)}`);
    }
  };

  // Secure Database Backup (Task 26)
  const handleBackup = async () => {
    try {
      const users = await getAllUsers();
      const backupData = [];
      for (const u of users) {
        const dbEmbeds = await getEmbeddingsForUser(u.id);
        const serializedEmbeds = dbEmbeds.map(e => ({
          embedding_base64: float32ArrayToBase64(e.embedding),
          version: e.embedding_version,
        }));
        backupData.push({
          name: u.name,
          embeddings: serializedEmbeds,
        });
      }
      
      const plaintext = JSON.stringify(backupData);
      const encrypted = await encryptData(plaintext);
      
      const backupPath = `${RNFS.DocumentDirectoryPath}/secure_edge_backup.enc`;
      await RNFS.writeFile(backupPath, encrypted, 'utf8');
      setStatus('Encrypted database backup created successfully!');
      console.log(`[Backup] Saved to ${backupPath}`);
    } catch (err) {
      setStatus(`Backup failed: ${errorMessage(err)}`);
    }
  };

  // Secure Database Restore (Task 26)
  const handleRestore = async () => {
    try {
      const backupPath = `${RNFS.DocumentDirectoryPath}/secure_edge_backup.enc`;
      const exists = await RNFS.exists(backupPath);
      if (!exists) {
        setStatus('No backup file found to restore.');
        return;
      }
      
      const encrypted = await RNFS.readFile(backupPath, 'utf8');
      const decrypted = await decryptData(encrypted);
      const backupData = JSON.parse(decrypted);
      
      for (const uData of backupData) {
        let user = usersList.find(u => u.name.toLowerCase() === uData.name.toLowerCase());
        let userId = user ? user.id : null;
        if (!userId) {
          userId = await createUser(uData.name);
        }
        for (const eData of uData.embeddings) {
          const Float32Arr = base64ToFloat32Array(eData.embedding_base64);
          await insertEmbedding(userId, Float32Arr, eData.version);
        }
      }
      
      await loadAll();
      setStatus('Database restored successfully from backup!');
    } catch (err) {
      setStatus(`Restore failed: ${errorMessage(err)}`);
    }
  };

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
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
 
      runAtTargetFps(INFERENCE_FPS, () => {
        'worklet';
        if (!frame.isValid) {
          return;
        }
 
        try {
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
            handleFrameResult(null, null, null, null);
            return;
          }
 
          const regressors = new Float32Array(blazeOutputs[0]);
          const classificators = new Float32Array(blazeOutputs[1]);
          const decoded = decodeBlazeFaceBox(regressors, classificators, blazeAnchors, FACE_SCORE_THRESHOLD);
 
          if (decoded.box == null || decoded.keypoints == null) {
            handleFrameResult(null, null, null, null);
            return;
          }
 
          // Face Size & Location Validation (Task 6 / Change 8)
          const width = decoded.box.xMax - decoded.box.xMin;
          const height = decoded.box.yMax - decoded.box.yMin;
          const isValidFace = width >= 0.20 && height >= 0.20 &&
                              decoded.box.xMin >= 0.05 && decoded.box.yMin >= 0.05 &&
                              decoded.box.xMax <= 0.95 && decoded.box.yMax <= 0.95;
 
          if (!isValidFace) {
            // Face detected but not valid -> skip MobileFaceNet, draw box in SCANNING state
            handleFrameResult(decoded.box, decoded.keypoints, blazePixels as Float32Array, null);
            return;
          }
 
          // Un-rotate and un-mirror the box for raw frame cropping
          const rawBox = unprocessBox(decoded.box, rotation, frame.isMirrored);
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
          const embeddingOutputs = faceNetModel.runSync([faceBuffer]);
 
          if (embeddingOutputs.length === 0 || embeddingOutputs[0].byteLength % 4 !== 0) {
            handleFrameResult(decoded.box, decoded.keypoints, blazePixels as Float32Array, null);
            return;
          }
 
          const embedding = new Float32Array(embeddingOutputs[0]);
          if (embedding.length === 0) {
            handleFrameResult(decoded.box, decoded.keypoints, blazePixels as Float32Array, null);
            return;
          }
 
          handleFrameResult(decoded.box, decoded.keypoints, blazePixels as Float32Array, embedding);
        } catch (error) {
          reportRuntimeError(errorMessage(error));
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
    ],
  );

  const cameraStatus = useMemo(() => {
    if (permissionError != null) {
      return permissionError;
    }
    if (cameraError != null) {
      return cameraError;
    }
    if (!hasPermission) {
      return 'Waiting for camera permission...';
    }
    if (device == null) {
      return `No ${cameraPosition} camera found on this device`;
    }
    return status;
  }, [cameraError, cameraPosition, device, hasPermission, permissionError, status]);

  return (
    <View style={styles.container}>
      {hasPermission && device != null ? (
        <Camera
          key={device.id}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
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

      {detectedBox != null ? (
        <View
          style={[
            styles.boundingBox,
            {
              left: detectedBox.xMin * SCREEN_WIDTH,
              top: detectedBox.yMin * SCREEN_HEIGHT,
              width: (detectedBox.xMax - detectedBox.xMin) * SCREEN_WIDTH,
              height: (detectedBox.yMax - detectedBox.yMin) * SCREEN_HEIGHT,
              borderColor:
                authState === 'AUTHENTICATED'
                  ? '#10B981'
                  : authState === 'REJECTED'
                    ? '#EF4444'
                    : '#F59E0B',
            },
          ]}
        >
          <View
            style={[
              styles.boxLabel,
              {
                backgroundColor:
                  authState === 'AUTHENTICATED'
                    ? '#10B981'
                    : authState === 'REJECTED'
                      ? '#EF4444'
                      : '#F59E0B',
              },
            ]}
          >
            <Text style={styles.boxLabelText}>
              {authState === 'AUTHENTICATED'
                ? `MATCH: ${authenticatedUser} (${(authScore * 100).toFixed(0)}%)`
                : authState === 'REJECTED'
                  ? `REJECTED (${(authScore * 100).toFixed(0)}%)`
                  : authState}
            </Text>
          </View>
        </View>
      ) : null}

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.statusBadge} pointerEvents="none">
          <Text style={styles.statusText}>{cameraStatus}</Text>
          <Text style={styles.detailText}>
            {isEmulator
              ? 'Emulator uses your PC webcam after AVD is set to Webcam0 (run scripts/set-emulator-webcam.ps1, then cold-boot).'
              : modelsReady
                ? `BlazeFace ${blazeInput?.width}x${blazeInput?.height} ${blazeInput?.dataType} | MobileFaceNet ${faceInput?.width}x${faceInput?.height} ${faceInput?.dataType}`
                : 'Preparing VisionCamera, Nitro, Worklets, and TFLite'}
          </Text>
          {format != null ? (
            <Text style={styles.detailText}>
              Preview stream: {format.videoWidth}x{format.videoHeight}
              {previewFps != null ? ` @ ${previewFps}fps` : ''}
            </Text>
          ) : null}
        </View>

        <View style={styles.guideContainer} pointerEvents="none">
          <View style={styles.guideBox} />
        </View>

        {!hasPermission ? (
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => {
              requestPermission()
                .then(granted => {
                  setPermissionError(granted ? undefined : 'Camera permission was denied');
                })
                .catch(error => {
                  setPermissionError(errorMessage(error));
                });
            }}
          >
            <Text style={styles.permissionButtonText}>Allow Camera</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.controlPanel}>
            <View style={styles.hardeningRow}>
              <Text style={styles.hardeningText}>
                🛡️ Root: {hardeningRoot ? '❌ ROOTED' : '✅ SECURE'}
              </Text>
              <Text style={styles.hardeningText}>
                🐞 Debugger: {hardeningDebugger ? '❌ ATTACHED' : '✅ SECURE'}
              </Text>
              <Text style={styles.hardeningText}>
                📦 APK: {hardeningIntegrity ? '✅ OK' : '❌ TAMPERED'}
              </Text>
            </View>

            {registeredUserSuccess != null ? (
              <View style={styles.successBanner}>
                <Text style={styles.successBannerText}>
                  🎉 Successfully registered {registeredUserSuccess}!
                </Text>
              </View>
            ) : null}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter username to register..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={registrationName}
                onChangeText={setRegistrationName}
              />
              <TouchableOpacity style={styles.actionButton} onPress={handleRegister}>
                <Text style={styles.actionButtonText}>Register Face</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonRow}>
              {isEmulator ? (
                <TouchableOpacity
                  style={[styles.secondaryButton, { flex: 1 }]}
                  onPress={() => {
                    setCameraPosition(current => (current === 'front' ? 'back' : 'front'));
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Switch Camera</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.dangerButton, { flex: isEmulator ? 1 : 2 }]}
                onPress={handleClearAll}
              >
                <Text style={styles.dangerButtonText}>Clear Db</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={handleBackup}>
                <Text style={styles.secondaryButtonText}>Backup Db</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={handleRestore}>
                <Text style={styles.secondaryButtonText}>Restore Db</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.infoText}>
              Liveness: {livenessStatus}
            </Text>

            <View style={styles.profileSection}>
              <Text style={styles.profileLabel}>
                Active Profile: <Text style={styles.profileValue}>{activeUser ? activeUser.name : 'None'}</Text>
              </Text>
              {activeUser ? (
                <View style={styles.userActionsRow}>
                  <TouchableOpacity 
                    style={styles.smallRenameButton} 
                    onPress={() => {
                      if (registrationName.trim()) {
                        handleRenameUser(activeUser.id, registrationName);
                        setRegistrationName('');
                      } else {
                        setStatus('Type new name in text field above, then press Rename.');
                      }
                    }}
                  >
                    <Text style={styles.smallButtonText}>Rename Active</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.smallDeleteButton} 
                    onPress={() => handleDeleteUser(activeUser.id)}
                  >
                    <Text style={styles.smallButtonText}>Delete Active</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              
              <Text style={styles.profileTitle}>Registered Profiles (Tap to Switch):</Text>
              <View style={styles.profilesContainer}>
                {usersList.map(u => (
                  <TouchableOpacity
                    key={u.id}
                    style={[
                      styles.profileBadge,
                      activeUser?.id === u.id && styles.activeProfileBadge
                    ]}
                    onPress={() => handleSwitchUser(u)}
                  >
                    <Text style={[
                      styles.profileBadgeText,
                      activeUser?.id === u.id && styles.activeProfileBadgeText
                    ]}>
                      {u.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {usersList.length === 0 && (
                  <Text style={styles.footerText}>None registered yet.</Text>
                )}
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
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
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statusBadge: {
    width: '100%',
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  detailText: {
    color: 'rgba(255,255,255,0.68)',
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  guideContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideBox: {
    width: SCREEN_WIDTH * 0.72,
    height: SCREEN_WIDTH * 0.72,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 8,
  },
  permissionButton: {
    marginBottom: 36,
    minHeight: 48,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#101010',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    width: '100%',
    marginBottom: 24,
    alignItems: 'center',
    gap: 10,
  },
  footerText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 8,
    zIndex: 10,
  },
  controlPanel: {
    width: '100%',
    backgroundColor: 'rgba(25, 25, 25, 0.85)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  textInput: {
    flex: 1,
    height: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 46,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 13,
  },
  dangerButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  dangerButtonText: {
    color: '#EF4444',
    fontWeight: '500',
    fontSize: 13,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  boxLabel: {
    position: 'absolute',
    top: -24,
    left: -3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  boxLabelText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 11,
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 8,
  },
  successBannerText: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 13,
  },
  hardeningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  hardeningText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '600',
  },
  profileSection: {
    width: '100%',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  profileLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  profileValue: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  profileTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  profilesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileBadge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  activeProfileBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3B82F6',
  },
  profileBadgeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  activeProfileBadgeText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  userActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallRenameButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  smallDeleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  smallButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '500',
  },
});
