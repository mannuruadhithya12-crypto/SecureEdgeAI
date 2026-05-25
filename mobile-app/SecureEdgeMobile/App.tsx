import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BLAZEFACE_FRONT_MODEL = require('./src/assets/models/blazeface_front.tflite');
const BLAZEFACE_BACK_MODEL = require('./src/assets/models/blazeface_back.tflite');
const MOBILEFACENET_MODEL = require('./src/assets/models/mobilefacenet.tflite');

const CPU_DELEGATES: TensorflowModelDelegate[] = [];
const FACE_SCORE_THRESHOLD = 0.5;
const MATCH_SCORE_THRESHOLD = 0.65;
const INFERENCE_FPS = 4;

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

function confidenceFromBuffer(buffer: ArrayBuffer): number {
  'worklet';
  if (buffer.byteLength === 0) {
    return 0;
  }

  let maxValue = -Infinity;
  if (buffer.byteLength % 4 === 0) {
    const values = new Float32Array(buffer);
    const limit = Math.min(values.length, 4096);
    for (let i = 0; i < limit; i += 1) {
      const value = values[i];
      if (value === value && value > maxValue) {
        maxValue = value;
      }
    }
  } else {
    const values = new Uint8Array(buffer);
    const limit = Math.min(values.length, 4096);
    for (let i = 0; i < limit; i += 1) {
      const value = values[i] / 255;
      if (value > maxValue) {
        maxValue = value;
      }
    }
  }

  if (maxValue === -Infinity) {
    return 0;
  }

  if (maxValue < 0 || maxValue > 1) {
    return 1 / (1 + Math.exp(-maxValue));
  }

  return maxValue;
}

function getFaceConfidence(outputs: ArrayBuffer[]): number {
  'worklet';
  if (outputs.length === 0) {
    return 0;
  }

  let best = 0;
  for (let i = 0; i < outputs.length; i += 1) {
    const buffer = outputs[i];
    if (buffer.byteLength > 4096 * 4) {
      continue;
    }

    const score = confidenceFromBuffer(buffer);
    if (score > best) {
      best = score;
    }
  }

  return best;
}

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

function normalizedBoxFromOutputs(outputs: ArrayBuffer[]): NormalizedBox | undefined {
  'worklet';
  if (outputs.length === 0 || outputs[0].byteLength < 16 || outputs[0].byteLength % 4 !== 0) {
    return undefined;
  }

  const values = new Float32Array(outputs[0]);
  if (values.length < 4) {
    return undefined;
  }

  const yMin = values[0];
  const xMin = values[1];
  const yMax = values[2];
  const xMax = values[3];
  const looksNormalized =
    xMin >= 0 &&
    xMin <= 1 &&
    xMax >= 0 &&
    xMax <= 1 &&
    yMin >= 0 &&
    yMin <= 1 &&
    yMax >= 0 &&
    yMax <= 1 &&
    xMax > xMin &&
    yMax > yMin;

  if (!looksNormalized) {
    return undefined;
  }

  return {
    xMin,
    yMin,
    xMax,
    yMax,
  };
}

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

function arrayFromEmbeddingBuffer(buffer: ArrayBuffer): number[] {
  'worklet';
  if (buffer.byteLength === 0 || buffer.byteLength % 4 !== 0) {
    return [];
  }

  const values = new Float32Array(buffer);
  const embedding: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    embedding.push(values[i]);
  }
  return embedding;
}

function cosineSimilarity(current: Float32Array, reference: number[]): number {
  'worklet';
  const length = Math.min(current.length, reference.length);
  if (length === 0) {
    return 0;
  }

  let dot = 0;
  let currentNorm = 0;
  let referenceNorm = 0;

  for (let i = 0; i < length; i += 1) {
    const a = current[i];
    const b = reference[i];
    dot += a * b;
    currentNorm += a * a;
    referenceNorm += b * b;
  }

  if (currentNorm === 0 || referenceNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(currentNorm) * Math.sqrt(referenceNorm));
}

function MainApp() {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const permissionRequestedRef = useRef(false);

  const [permissionError, setPermissionError] = useState<string>();
  const [cameraError, setCameraError] = useState<string>();
  const [runtimeError, setRuntimeError] = useState<string>();
  const [status, setStatus] = useState('Initializing AI runtime...');
  const [referenceEmbedding, setReferenceEmbedding] = useState<number[]>();

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
    } else if (referenceEmbedding == null) {
      setStatus('Align face to capture reference embedding');
    } else {
      setStatus('AI ready');
    }
  }, [integrationError, modelsReady, referenceEmbedding]);

  const updateStatus = useRunOnJS((nextStatus: string) => {
    setStatus(current => (current === nextStatus ? current : nextStatus));
  }, []);

  const reportRuntimeError = useRunOnJS((message: string) => {
    setRuntimeError(message);
  }, []);

  const captureReferenceEmbedding = useRunOnJS((embedding: number[]) => {
    setReferenceEmbedding(current => current ?? embedding);
  }, []);

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
          const confidence = getFaceConfidence(blazeOutputs);

          if (confidence < FACE_SCORE_THRESHOLD) {
            updateStatus('Align face in the guide');
            return;
          }

          const faceCrop = faceCropForFrame(
            frame.width,
            frame.height,
            normalizedBoxFromOutputs(blazeOutputs),
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
            updateStatus('Embedding output is not float32');
            return;
          }

          const embedding = new Float32Array(embeddingOutputs[0]);
          if (embedding.length === 0) {
            updateStatus('Embedding output is empty');
            return;
          }

          if (referenceEmbedding == null) {
            captureReferenceEmbedding(arrayFromEmbeddingBuffer(embeddingOutputs[0]));
            updateStatus('Reference embedding captured');
            return;
          }

          const similarity = cosineSimilarity(embedding, referenceEmbedding);
          const rounded = Math.round(similarity * 1000) / 1000;
          updateStatus(
            similarity >= MATCH_SCORE_THRESHOLD
              ? `Authenticated (${rounded})`
              : `Face mismatch (${rounded})`,
          );
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
      referenceEmbedding,
      updateStatus,
      reportRuntimeError,
      captureReferenceEmbedding,
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
      return 'No front camera found on this emulator';
    }
    return status;
  }, [cameraError, device, hasPermission, permissionError, status]);

  return (
    <View style={styles.container}>
      {hasPermission && device != null ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          pixelFormat="yuv"
          enableBufferCompression={false}
          frameProcessor={modelsReady ? frameProcessor : undefined}
          onInitialized={() => {
            setCameraError(undefined);
          }}
          onError={error => {
            setCameraError(`${error.code}: ${error.message}`);
          }}
        />
      ) : null}

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.statusBadge} pointerEvents="none">
          <Text style={styles.statusText}>{cameraStatus}</Text>
          <Text style={styles.detailText}>
            {modelsReady
              ? `BlazeFace ${blazeInput?.width}x${blazeInput?.height} ${blazeInput?.dataType} | MobileFaceNet ${faceInput?.width}x${faceInput?.height} ${faceInput?.dataType}`
              : 'Preparing VisionCamera, Nitro, Worklets, and TFLite'}
          </Text>
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
          <View style={styles.footer} pointerEvents="none">
            <Text style={styles.footerText}>
              {referenceEmbedding == null
                ? 'First valid embedding becomes the in-memory reference for this runtime check.'
                : 'Reference embedding loaded in memory.'}
            </Text>
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
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  footerText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
