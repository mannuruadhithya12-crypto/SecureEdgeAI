import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { Camera, useCameraDevice, usePhotoOutput, CameraRef } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import { requestPermission, captureImage } from '../services/cameraService';
import { authenticateUser } from '../services/authenticateUser';
import { registerUser } from '../services/registerUser';
import { getActiveFaceEmbedding, setActiveFaceEmbedding } from '../services/embeddingStorage';
import { perfMetrics, useFpsLogger } from '../utils/qaHelpers';
import FaceGuide from '../components/FaceGuide';
import FaceBox from '../components/FaceBox';
import SystemStatus from '../components/SystemStatus';
import AuthResult from '../components/AuthResult';

export default function FaceAuthScreen({ route, navigation }: any) {
  const { mode, name, employeeId } = route.params || {};

  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [livenessScore, setLivenessScore] = useState<number | undefined>(undefined);
  
  // State Machine: loading -> no-face -> detecting -> matching -> success/failed
  const [authState, setAuthState] = useState<'loading' | 'no-face' | 'detecting' | 'matching' | 'success' | 'failed'>('loading');
  const [authDecision, setAuthDecision] = useState<'valid' | 'uncertain' | 'reject'>('reject');
  const [similarityResult, setSimilarityResult] = useState(0.0);
  const [verifiedName, setVerifiedName] = useState<string | undefined>(undefined);

  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraRef>(null);
  const device = useCameraDevice(cameraPosition);
  const photoOutput = usePhotoOutput();

  const showOverlay = authState === 'success' || authState === 'failed';
  const isCameraActive = isFocused && !showOverlay;

  // Run real-time performance FPS tracking when camera is active
  useFpsLogger('FaceAuthScreen', isCameraActive);

  useEffect(() => {
    const getPermissions = async () => {
      const granted = await requestPermission();
      setHasPermission(granted);
      if (granted) {
        setAuthState('no-face');
      }
    };
    getPermissions();
  }, []);

  // Simulate active face tracking/detection in the emulator view
  useEffect(() => {
    if (authState === 'no-face') {
      const timer = setTimeout(() => {
        setAuthState('detecting');
        setLivenessScore(0.985); // Simulated high liveness confidence
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [authState]);

  const toggleCamera = () => {
    setCameraPosition((prev) => (prev === 'front' ? 'back' : 'front'));
    setAuthState('no-face');
    setLivenessScore(undefined);
  };

  const handleCaptureAuth = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    setAuthState('matching');
    console.log('[FaceAuth] Capture START.');

    try {
      // 1. Capture the image frame
      const captureStart = Date.now();
      const imageUri = await captureImage(photoOutput);
      const captureDuration = Date.now() - captureStart;
      perfMetrics.captureLatencyMs = captureDuration;
      console.log(`🛡️ [QA-Perf] [Capture] Frame captured in ${captureDuration}ms. Path: ${imageUri}`);

      let mockEmbedding: number[];

      if (mode === 'register') {
        // Generate a random vector and normalize it to unit length
        const rawVector = Array.from({ length: 192 }, () => Math.random() * 2 - 1);
        const norm = Math.sqrt(rawVector.reduce((sum, val) => sum + val * val, 0));
        mockEmbedding = rawVector.map(val => val / norm);

        console.log(`[FaceAuth] Registering user ${name} with ID ${employeeId}. Embedding length: ${mockEmbedding.length}`);
        
        // Update the active physical face in memory to match this registered user
        setActiveFaceEmbedding(mockEmbedding);

        const writeStart = Date.now();
        const result = await registerUser(name, employeeId, mockEmbedding);
        const writeDuration = Date.now() - writeStart;
        console.log(`🛡️ [QA-Perf] [Database] Register user SQLite write complete. Latency: ${writeDuration}ms`);

        if (result.success) {
          setSimilarityResult(1.0);
          setAuthDecision('valid');
          setAuthState('success');
        } else {
          setSimilarityResult(0.0);
          setAuthDecision('reject');
          setAuthState('failed');
        }
      } else {
        // Verification Mode: load the active physical face, add a tiny bit of noise, and normalize
        const activeVector = await getActiveFaceEmbedding(employeeId);
        const noiseFactor = 0.05; // 5% noise to simulate new capture variation
        const noisyVector = activeVector.map(val => val + (Math.random() * 2 - 1) * noiseFactor);
        const norm = Math.sqrt(noisyVector.reduce((sum, val) => sum + val * val, 0));
        mockEmbedding = noisyVector.map(val => val / norm);

        console.log(`[FaceAuth] Authenticating user with ID ${employeeId}. Live embedding length: ${mockEmbedding.length}`);
        
        const authStart = Date.now();
        const result = await authenticateUser(employeeId, mockEmbedding);
        const authDuration = Date.now() - authStart;
        perfMetrics.authLatencyMs = authDuration;
        console.log(`🛡️ [QA-Perf] [Auth] Inference & SQLite lookup complete. Latency: ${authDuration}ms (Similarity: ${(result.similarity * 100).toFixed(2)}%)`);
        
        setSimilarityResult(result.similarity);
        setAuthDecision(result.decision);
        if (result.name) {
          setVerifiedName(result.name);
        }
        
        if (result.success) {
          setAuthState('success');
        } else {
          setAuthState('failed');
        }
      }
    } catch (error) {
      console.error('[FaceAuth] Match process failed:', error);
      setAuthState('failed');
      setAuthDecision('reject');
    } finally {
      console.log('[FaceAuth] Capture END.');
      setIsCapturing(false);
    }
  };

  const handleReset = () => {
    setAuthState('no-face');
    setLivenessScore(undefined);
    setSimilarityResult(0.0);
    setVerifiedName(undefined);
  };

  const handleProceedHome = () => {
    navigation.popToTop(); // Return to Login
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
      <View style={StyleSheet.absoluteFill}>
        <Camera
          ref={cameraRef}
          style={[
            StyleSheet.absoluteFill,
            cameraPosition === 'front' ? { transform: [{ scaleX: -1 }] } : undefined
          ]}
          device={device}
          isActive={isCameraActive}
          outputs={[photoOutput]}
          enableNativeZoomGesture={true}
          implementationMode="performance"
          resizeMode="cover"
          mirrorMode="off"
          onStarted={() => {
            console.log('[FaceAuthScreen] Camera session started lifecycle callback.');
          }}
          onStopped={() => {
            console.log('[FaceAuthScreen] Camera session stopped lifecycle callback.');
          }}
          onError={(error) => {
            console.warn('[FaceAuthScreen] Camera session error/interruption callback:', error);
          }}
        />

        {/* Diagnostic Scan Overlays */}
        <FaceGuide />
        <FaceBox status={authState} />

        {/* Real-time state HUD */}
        <SafeAreaView style={styles.hudOverlay}>
          <SystemStatus status={authState} livenessConfidence={livenessScore} />
        </SafeAreaView>

        {/* Main Controls Panel */}
        {!showOverlay && (
          <SafeAreaView style={styles.controlsContainer}>
            <TouchableOpacity style={styles.circularButton} onPress={toggleCamera}>
              <Text style={styles.iconText}>🔄</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.captureButtonOuter,
                authState === 'no-face' && styles.disabledCaptureOuter
              ]}
              onPress={handleCaptureAuth}
              disabled={authState === 'no-face' || authState === 'matching'}
            >
              <View
                style={[
                  styles.captureButtonInner,
                  authState === 'no-face' && styles.disabledCaptureInner
                ]}
              >
                {authState === 'matching' && <ActivityIndicator size="small" color="#6366f1" />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.circularButton} onPress={() => navigation.goBack()}>
              <Text style={styles.iconText}>🚪</Text>
            </TouchableOpacity>
          </SafeAreaView>
        )}

        {/* Auth Result Card Overlay */}
        {showOverlay && (
          <View style={styles.resultOverlay}>
            <AuthResult
              decision={authDecision}
              similarity={similarityResult}
              name={mode === 'register' ? name : (authDecision === 'valid' ? verifiedName : undefined)}
              employeeId={employeeId}
              onRetry={handleReset}
              onProceed={handleProceedHome}
            />
          </View>
        )}
      </View>
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
  hudOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
  disabledCaptureOuter: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureButtonInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledCaptureInner: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  resultOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 10, 15, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
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
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
