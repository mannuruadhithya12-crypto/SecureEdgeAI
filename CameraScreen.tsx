import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';

interface CameraScreenProps {
  onClose?: () => void;
}

export default function CameraScreen({ onClose }: CameraScreenProps) {
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(cameraPosition);

  const toggleCamera = () => {
    setCameraPosition((prev) => (prev === 'front' ? 'back' : 'front'));
  };

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
      <Camera
        style={[
          StyleSheet.absoluteFill,
          cameraPosition === 'front' ? { transform: [{ scaleX: -1 }] } : undefined
        ]}
        device={device}
        isActive={true}
        enableNativeZoomGesture={true}
        implementationMode="performance"
        resizeMode="cover"
        mirrorMode="off"
        onError={(error) => {
          console.warn('[CameraScreenRoot] Camera session error/interruption:', error);
        }}
      />

      {/* Modern Overlay HUD */}
      <SafeAreaView style={styles.overlayContainer}>
        <View style={styles.header}>
          <Text style={styles.titleText}>SecureEdgeAI Camera</Text>
          <Text style={styles.subTitleText}>Offline Face Recognition & Liveness</Text>
        </View>

        {/* Center Scanner Frame */}
        <View style={styles.scannerFrameContainer}>
          <View style={styles.scannerFrame} />
        </View>

        <View style={styles.controlsContainer}>
          <TouchableOpacity style={styles.glassButton} onPress={toggleCamera}>
            <Text style={styles.buttonText}>
              Switch to {cameraPosition === 'front' ? 'Back' : 'Front'}
            </Text>
          </TouchableOpacity>

          {onClose && (
            <TouchableOpacity style={[styles.glassButton, styles.closeButton]} onPress={onClose}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
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
  },
  statusText: {
    color: '#a1a1aa',
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'System',
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
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  subTitleText: {
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 4,
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
    width: 260,
    height: 260,
    borderWidth: 2,
    borderColor: '#6366f1',
    borderRadius: 130,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderStyle: 'dashed',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 36,
    paddingHorizontal: 20,
    gap: 16,
  },
  glassButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
