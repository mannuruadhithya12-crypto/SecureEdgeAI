import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission
} from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { NitroModules } from 'react-native-nitro-modules';
import { useFaceDetectionFrameProcessor } from './FrameProcessor';
import { type FaceDetection } from '../ai/faceDetection';
import { FaceBox } from '../components/FaceBox';

const BLAZEFACE_FRONT = require('../assets/models/blazeface_front.tflite');

export const CameraView: React.FC = () => {
  const device = useCameraDevice('front');
  const { hasPermission } = useCameraPermission();
  const [detection, setDetection] = useState<FaceDetection | null>(null);

  const model = useTensorflowModel(BLAZEFACE_FRONT);
  const boxedModel = useMemo(() => {
    if (model.state === 'loaded') {
      return NitroModules.box(model.model);
    }
    return undefined;
  }, [model]);

  const frameProcessor = useFaceDetectionFrameProcessor(
    boxedModel,
    (face) => {
      setDetection(face);
    },
    5
  );

  if (!hasPermission) return <View style={styles.container}><Text>No Camera Permission</Text></View>;
  if (device == null) return <View style={styles.container}><Text>No Camera Device</Text></View>;

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        pixelFormat="yuv"
        frameProcessor={frameProcessor}
      />

      {/* Realtime Face Overlay */}
      <FaceBox detection={detection} />

      {model.state === 'loading' && (
        <View style={styles.overlay}>
          <Text style={styles.statusText}>Loading BlazeFace...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  overlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusText: {
    color: 'yellow',
    fontSize: 14,
  },
});
