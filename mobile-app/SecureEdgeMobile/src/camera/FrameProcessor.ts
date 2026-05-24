import { useMemo } from 'react';
import {
  useFrameProcessor,
  runAtTargetFps,
  type Frame
} from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import { createResizePlugin } from 'vision-camera-resize-plugin';
import { type TfliteModel } from 'react-native-fast-tflite';
import { type BoxedHybridObject } from 'react-native-nitro-modules';
import { processBlazeFaceOutput, type FaceDetection } from '../ai/faceDetection';

/**
 * Utility to convert VisionCamera orientation to degrees
 */
function rotationForFrame(orientation: string): '0deg' | '90deg' | '180deg' | '270deg' {
  'worklet';
  switch (orientation) {
    case 'landscape-left': return '90deg';
    case 'landscape-right': return '270deg';
    case 'portrait-upside-down': return '180deg';
    default: return '0deg';
  }
}

/**
 * Hook to create a face detection frame processor
 */
export function useFaceDetectionFrameProcessor(
  modelBox: BoxedHybridObject<TfliteModel> | undefined,
  onFaceDetected: (face: FaceDetection | null) => void,
  fps: number = 10
) {
  const { resize } = useMemo(() => createResizePlugin(), []);
  const reportFace = useRunOnJS(onFaceDetected);

  return useFrameProcessor((frame: Frame) => {
    'worklet';
    if (modelBox == null) return;

    runAtTargetFps(fps, () => {
      'worklet';
      try {
        const model = modelBox.unbox();
        const rotation = rotationForFrame(frame.orientation);

        // 1. Resize & Preprocess (uint8 for stability)
        const resized = resize(frame, {
          scale: {
            width: 128,
            height: 128,
          },
          rotation,
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });
        console.log("Frame resize successful");

        // 2. Manual normalization to float32
        const float32Data = new Float32Array(resized.length);
        for (let i = 0; i < resized.length; i++) {
          float32Data[i] = resized[i] / 255.0;
        }
        console.log("Tensor normalization successful");

        // 3. Run Inference
        console.log("Running BlazeFace inference");
        const outputs = model.runSync([float32Data.buffer as ArrayBuffer]);
        console.log("BlazeFace inference executed");
        console.log(outputs);

        // 4. Parse & Filter
        const face = processBlazeFaceOutput(outputs);

        // 5. Report results
        reportFace(face);
      } catch (error) {
        console.error('[FrameProcessor] Inference failed:', error);
      }
    });
  }, [modelBox, resize, reportFace, fps]);
}
