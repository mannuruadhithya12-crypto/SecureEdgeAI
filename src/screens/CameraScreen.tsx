import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Image, SafeAreaView } from 'react-native';
import { Camera, useCameraDevice, usePhotoOutput, CameraRef } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import { requestPermission, captureImage } from '../services/cameraService';

export default function CameraScreen({ navigation, route }: any) {
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const cameraRef = useRef<CameraRef>(null);
  const device = useCameraDevice(cameraPosition);
  const photoOutput = usePhotoOutput();
  const isFocused = useIsFocused();

  useEffect(() => {
    const getPermissions = async () => {
      const granted = await requestPermission();
      setHasPermission(granted);
    };
    getPermissions();
  }, []);

  const toggleCamera = () => {
    setCameraPosition((prev) => (prev === 'front' ? 'back' : 'front'));
  };

  const handleCapture = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const imageUri = await captureImage(photoOutput);
      setCapturedImage(imageUri);
    } catch (error) {
      console.error('[CameraScreen] Capture failed:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleProceed = () => {
    if (capturedImage) {
      const { mode, name, employeeId } = route.params || {};
      navigation.navigate('Processing', {
        imageUri: capturedImage,
        mode,
        name,
        employeeId,
      });
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.statusText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No Camera Access Granted.</Text>
        <TouchableOpacity style={styles.glassButton} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.statusText}>Searching for camera device...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {capturedImage ? (
        // Preview mode for captured image
        <View style={StyleSheet.absoluteFill}>
          <Image source={{ uri: capturedImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          
          <SafeAreaView style={styles.overlayContainer}>
            <View style={styles.header}>
              <Text style={styles.titleText}>Verify Image</Text>
              <Text style={styles.subTitleText}>Ensure your face is clearly visible and centered</Text>
            </View>

            <View style={styles.previewControls}>
              <TouchableOpacity style={[styles.glassButton, styles.retakeButton]} onPress={handleRetake}>
                <Text style={styles.buttonText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.glassButton, styles.proceedButton]} onPress={handleProceed}>
                <Text style={styles.buttonText}>Proceed</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      ) : (
        // Live camera preview mode
        <View style={StyleSheet.absoluteFill}>
          <Camera
            ref={cameraRef}
            style={[
              StyleSheet.absoluteFill,
              cameraPosition === 'front' ? { transform: [{ scaleX: -1 }] } : undefined
            ]}
            device={device}
            isActive={isFocused && !capturedImage}
            outputs={[photoOutput]}
            enableNativeZoomGesture={true}
            implementationMode="performance"
            resizeMode="cover"
            mirrorMode="off"
            onError={(error) => {
              console.warn('[CameraScreen] Camera session error/interruption:', error);
            }}
          />

          {/* HUD Overlay */}
          <SafeAreaView style={styles.overlayContainer}>
            <View style={styles.header}>
              <Text style={styles.titleText}>Align Your Face</Text>
              <Text style={styles.subTitleText}>Position face inside the frame</Text>
            </View>

            {/* Oval Face Guide Frame */}
            <View style={styles.scannerFrameContainer}>
              <View style={styles.scannerFrame} />
            </View>

            <View style={styles.controlsContainer}>
              <TouchableOpacity style={styles.circularButton} onPress={toggleCamera}>
                <Text style={styles.iconText}>🔄</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.captureButtonOuter} onPress={handleCapture} disabled={isCapturing}>
                <View style={styles.captureButtonInner}>
                  {isCapturing && <ActivityIndicator size="small" color="#6366f1" />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.circularButton} onPress={() => navigation.goBack()}>
                <Text style={styles.iconText}>🚪</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    paddingHorizontal: 24,
  },
  statusText: {
    color: '#a1a1aa',
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  subTitleText: {
    color: '#d4d4d8',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  scannerFrameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 310,
    borderWidth: 2,
    borderColor: '#6366f1',
    borderRadius: 125,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderStyle: 'solid',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  circularButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
    color: '#fff',
  },
  captureButtonOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  captureButtonInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 44,
    paddingHorizontal: 20,
    gap: 20,
  },
  glassButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    minWidth: 130,
    alignItems: 'center',
  },
  retakeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  proceedButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
