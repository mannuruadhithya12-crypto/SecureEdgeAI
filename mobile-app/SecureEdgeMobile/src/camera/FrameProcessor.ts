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
  fps: number = 5
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

        // 1. Resize & Preprocess
        // BlazeFace expects 128x128 RGB
        const resized = resize(frame, {
          scale: {
            width: 128,
            height: 128,
          },
          rotation,
          pixelFormat: 'rgb',
          dataType: 'float32',
        });

        // 2. Run Inference
        const outputs = model.runSync([resized.buffer as ArrayBuffer]);

        // 3. Parse & Filter
        const face = processBlazeFaceOutput(outputs);

        // 4. Report results
        reportFace(face);
      } catch (error) {
        console.error('[FrameProcessor] Inference failed:', error);
      }
    });
  }, [modelBox, resize, reportFace, fps]);
}
