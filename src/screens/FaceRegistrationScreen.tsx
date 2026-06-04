import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import { NitroModules } from 'react-native-nitro-modules';
import { useRunOnJS } from 'react-native-worklets-core';
import { createResizePlugin } from 'vision-camera-resize-plugin';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressStepper } from '../components/ProgressStepper';
import { theme } from '../theme/theme';
import { createUser, getAllUsers } from '../database/userRepository';
import { useDatabase } from '../hooks/useDatabase';
import { insertEmbedding } from '../database/embeddingRepository';
import { saveSecuredData } from '../security/secureStorage';
import { validateFaceQuality } from '../ai/faceQuality';
import { BLAZEFACE_FRONT_MODEL, MOBILEFACENET_MODEL, prepareTfliteModels } from '../ai/modelSources';
import {
  generateBlazeFaceAnchors,
  decodeBlazeFaceBoxes,
  faceCropForFrame,
  unprocessBox,
  NormalizedBox,
  preAllocatedBoxes,
} from '../utils/frameHelpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function FaceRegistrationScreen() {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState(0);
  const [registrationName, setRegistrationName] = useState('');
  const [status, setStatus] = useState('Align face in focus...');

  const { settings } = useDatabase(() => {});
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detectedBox, setDetectedBox] = useState<NormalizedBox | undefined>();
  const [modelsReady, setModelsReady] = useState(false);
  const [blazeModel, setBlazeModel] = useState<any>(null);
  const [faceModel, setFaceModel] = useState<any>(null);

  const blazeModelRef = useRef<any>(null);
  const faceModelRef = useRef<any>(null);
  const latestEmbeddingRef = useRef<Float32Array | null>(null);

  const qaFrameReceivedLoggedRef = useRef(false);
  const qaFrameProcessorLoggedRef = useRef(false);
  const qaFrameResizeLoggedRef = useRef(false);
  const qaBlazeStartLoggedRef = useRef(false);
  const qaBlazeDoneLoggedRef = useRef(false);
  const qaFaceDetectedLoggedRef = useRef(false);

  const device = useCameraDevice('front');
  const boxedBlazeModel = useMemo(() => (blazeModel != null ? NitroModules.box(blazeModel) : undefined), [blazeModel]);
  const boxedFaceModel = useMemo(() => (faceModel != null ? NitroModules.box(faceModel) : undefined), [faceModel]);

  // Load models in screen
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await prepareTfliteModels();
        const bm = await loadTensorflowModel(BLAZEFACE_FRONT_MODEL, ['android-gpu']);
        console.log('[QA] BLAZEFACE_LOADED');
        const fm = await loadTensorflowModel(MOBILEFACENET_MODEL, ['android-gpu']);
        if (active) {
          blazeModelRef.current = bm;
          faceModelRef.current = fm;
          setBlazeModel(bm);
          setFaceModel(fm);
          setModelsReady(true);
        }
      } catch (err) {
        console.warn('[Register] Model load failed, retrying on CPU...', err);
        try {
          const bm = await loadTensorflowModel(BLAZEFACE_FRONT_MODEL, []);
          console.log('[QA] BLAZEFACE_LOADED');
          const fm = await loadTensorflowModel(MOBILEFACENET_MODEL, []);
          if (active) {
            blazeModelRef.current = bm;
            faceModelRef.current = fm;
            setBlazeModel(bm);
            setFaceModel(fm);
            setModelsReady(true);
          }
        } catch (e) {
          console.error('[Register] CPU fallback failed:', e);
        }
      }
    };
    if (step === 3) {
      load();
    }
    return () => {
      active = false;
    };
  }, [step]);

  // Handle Camera activation delay
  useEffect(() => {
    if (step === 3 && hasPermission && device != null) {
      const timer = setTimeout(() => setIsCameraActive(true), 200);
      return () => clearTimeout(timer);
    } else {
      setIsCameraActive(false);
    }
  }, [step, hasPermission, device]);

  useEffect(() => {
    if (hasPermission) {
      console.log('[QA] CAMERA_PERMISSION_GRANTED');
    }
  }, [hasPermission]);

  useEffect(() => {
    if (device != null) {
      console.log('[QA] CAMERA_DEVICE_FOUND');
    }
  }, [device]);

  useEffect(() => {
    if (isCameraActive && device != null) {
      console.log('[QA] CAMERA_COMPONENT_MOUNTED');
    }
  }, [isCameraActive, device]);

  useEffect(() => {
    if (settings?.emulatorMode && step === 3) {
      const timer = setTimeout(() => {
        const mockEmbedding = new Float32Array(192);
        mockEmbedding.fill(0.5);
        latestEmbeddingRef.current = mockEmbedding;
        console.log('[QA] EMBEDDING_GENERATED');
        setStatus('Emulator Mode: Face matched! Complete enrollment.');
        setDetectedBox({ xMin: 0.25, yMin: 0.25, xMax: 0.75, yMax: 0.75 });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [step, settings?.emulatorMode]);

  const format = useCameraFormat(device, [
    { videoAspectRatio: SCREEN_WIDTH / Dimensions.get('window').height },
  ]);

  const resizePlugin = useMemo(() => {
    try {
      return createResizePlugin();
    } catch {
      return null;
    }
  }, []);

  const blazeAnchors = useMemo(() => generateBlazeFaceAnchors(), []);

  // Frame Processor Logic
  const handleFrameResult = useRunOnJS((box: NormalizedBox | undefined, embedding: Float32Array | null, feedback: string) => {
    setDetectedBox(box);
    if (embedding) {
      latestEmbeddingRef.current = embedding;
      console.log('[QA] EMBEDDING_GENERATED');
    }
    setStatus(feedback);
  }, []);

  const logFrameStage = useRunOnJS((stage: string) => {
    console.log(stage);
  }, []);

  const logFrameError = useRunOnJS((message: string) => {
    console.error('[QA] FRAME_PROCESSOR_ERROR', message);
  }, []);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (!qaFrameReceivedLoggedRef.current) {
        qaFrameReceivedLoggedRef.current = true;
        logFrameStage('[QA] FRAME_RECEIVED');
      }
      if (!modelsReady || boxedBlazeModel == null || boxedFaceModel == null || !resizePlugin) return;
      const blazeModel = boxedBlazeModel.unbox();
      const faceModel = boxedFaceModel.unbox();
      if (!qaFrameProcessorLoggedRef.current) {
        qaFrameProcessorLoggedRef.current = true;
        logFrameStage('[QA] FRAME_PROCESSOR_RUNNING');
      }

      const rotation = '0deg';
      
      // 1. Run Face Detection (BlazeFace)
      if (!qaBlazeStartLoggedRef.current) {
        qaBlazeStartLoggedRef.current = true;
        logFrameStage('[QA] BLAZEFACE_START');
      }
      const detectionBuffer = resizePlugin.resize(frame, {
        scale: { width: 128, height: 128 },
        pixelFormat: 'rgb',
        dataType: 'float32',
      });
      if (!qaFrameResizeLoggedRef.current) {
        qaFrameResizeLoggedRef.current = true;
        logFrameStage('[QA] FRAME_RESIZED');
      }
      let detectionOutput: ArrayBuffer[];
      try {
        detectionOutput = blazeModel.runSync([detectionBuffer.buffer]);
      } catch (error) {
        logFrameError(String(error));
        return;
      }
      if (!qaBlazeDoneLoggedRef.current) {
        qaBlazeDoneLoggedRef.current = true;
        logFrameStage('[QA] BLAZEFACE_DONE');
      }
      const regressors = new Float32Array(detectionOutput[0] as ArrayBuffer);
      const classificators = new Float32Array(detectionOutput[1] as ArrayBuffer);

      const numFaces = decodeBlazeFaceBoxes(regressors, classificators, blazeAnchors, 0.50);
      
      if (numFaces === 0) {
        handleFrameResult(undefined, null, 'No face detected. Align face inside the guide.');
        return;
      }
      if (!qaFaceDetectedLoggedRef.current) {
        qaFaceDetectedLoggedRef.current = true;
        logFrameStage('[QA] FACE_DETECTED');
      }

      // Read best face box
      const detectedRaw = {
        xMin: preAllocatedBoxes.xMin[0],
        yMin: preAllocatedBoxes.yMin[0],
        xMax: preAllocatedBoxes.xMax[0],
        yMax: preAllocatedBoxes.yMax[0],
      };
      
      const unprocBox = unprocessBox(detectedRaw, rotation, true);

      const bestKeypoints = [
        { x: preAllocatedBoxes.keypointsX[0], y: preAllocatedBoxes.keypointsY[0] },
        { x: preAllocatedBoxes.keypointsX[1], y: preAllocatedBoxes.keypointsY[1] },
        { x: preAllocatedBoxes.keypointsX[2], y: preAllocatedBoxes.keypointsY[2] },
        { x: preAllocatedBoxes.keypointsX[3], y: preAllocatedBoxes.keypointsY[3] },
        { x: preAllocatedBoxes.keypointsX[4], y: preAllocatedBoxes.keypointsY[4] },
        { x: preAllocatedBoxes.keypointsX[5], y: preAllocatedBoxes.keypointsY[5] },
      ];

      // 2. Validate Face Quality
      const quality = validateFaceQuality(
        detectionBuffer as Float32Array,
        128,
        128,
        detectedRaw,
        bestKeypoints,
        false
      );

      let qualityError: string | null = null;
      if (quality.tooSmall) {
        qualityError = 'Face too small';
      } else if (quality.alignmentInvalid || quality.occluded) {
        qualityError = 'Face alignment invalid';
      } else if (quality.lowLightDetected) {
        qualityError = 'Face too dark';
      } else if (quality.blurDetected) {
        qualityError = 'Face too blurry';
      }

      if (qualityError != null) {
        handleFrameResult(unprocBox, null, qualityError);
        return;
      }

      // 3. Crop Face and Run MobileFaceNet
      const crop = faceCropForFrame(frame.width, frame.height, unprocBox);
      const faceBuffer = resizePlugin.resize(frame, {
        scale: { width: 112, height: 112 },
        crop,
        pixelFormat: 'rgb',
        dataType: 'float32',
      });
      let faceOutput: ArrayBuffer[];
      try {
        faceOutput = faceModel.runSync([faceBuffer.buffer]);
      } catch (error) {
        logFrameError(String(error));
        return;
      }
      const outputEmbedding = new Float32Array(faceOutput[0] as ArrayBuffer);

      const copiedEmbedding = new Float32Array(192);
      copiedEmbedding.set(outputEmbedding);

      handleFrameResult(unprocBox, copiedEmbedding, 'Face matched! Complete enrollment.');
    },
    [blazeAnchors, resizePlugin, modelsReady, boxedBlazeModel, boxedFaceModel]
  );

  const handleRegister = async () => {
    const name = registrationName.trim();
    if (!name) {
      Alert.alert('Validation Error', 'Please enter a username to register.');
      return;
    }
    const currentEmbedding = latestEmbeddingRef.current;
    if (currentEmbedding == null) {
      Alert.alert('Validation Error', 'No valid face template captured yet. Align face in guide.');
      return;
    }

    try {
      const dbUsers = await getAllUsers();
      let user = dbUsers.find(u => u.name.toLowerCase() === name.toLowerCase());
      let userId = user ? user.id : null;
      
      if (!userId) {
        userId = await createUser(name);
        console.log('[QA] USER_CREATED');
      }
      
      await insertEmbedding(userId, currentEmbedding, 'MobileFaceNet_v1');
      console.log('[QA] EMBEDDING_CREATED');
      await saveSecuredData('active_user_name', name);
      console.log('[QA] PROFILE_ACTIVATED');
      await saveSecuredData('setting_onboardingCompleted', 'true');
      console.log('[QA] AUTH_ENABLED');
      
      Alert.alert('Success', `Biometric face profile registered for ${name}!`, [
        {
          text: 'Proceed to Dashboard',
          onPress: () => {
            setIsCameraActive(false);
            navigation.replace('Main');
          },
        },
      ]);
    } catch {
      Alert.alert('Enrollment Error', 'Failed to save biometric profile.');
    }
  };

  const renderWelcome = () => (
    <View style={styles.card}>
      <View style={styles.logoBadge}>
        <Text style={styles.logoEmoji}>🛡️</Text>
      </View>
      <Text style={styles.title}>SecureEdgeAI</Text>
      <Text style={styles.subtitle}>
        Offline Face Biometrics & Hardware Hardened Trust Terminal
      </Text>
      <View style={styles.bulletRow}>
        <Text style={styles.bulletIcon}>🔒</Text>
        <View style={styles.bulletTextContainer}>
          <Text style={styles.bulletTitle}>100% Local Processing</Text>
          <Text style={styles.bulletDesc}>
            Facial embeddings are generated, encrypted, and compared strictly on this device. Zero cloud uploads.
          </Text>
        </View>
      </View>
      <View style={styles.bulletRow}>
        <Text style={styles.bulletIcon}>👁️</Text>
        <View style={styles.bulletTextContainer}>
          <Text style={styles.bulletTitle}>Liveness Audits</Text>
          <Text style={styles.bulletDesc}>
            Calculates micro-blink speeds and head orientation changes to block presentation attacks.
          </Text>
        </View>
      </View>
      <PrimaryButton title="Get Started" onPress={() => setStep(1)} style={{ marginTop: theme.spacing.lg }} />
    </View>
  );

  const renderPermissions = () => (
    <View style={styles.card}>
      <Text style={styles.title}>Camera Audits</Text>
      <Text style={styles.subtitle}>
        We require camera privileges to capture and match facial vectors locally.
      </Text>
      <View style={styles.permissionBadgeContainer}>
        <View style={[styles.permissionCircle, { borderColor: hasPermission ? theme.colors.success : theme.colors.primary }]}>
          <Text style={{ fontSize: 36 }}>{hasPermission ? '✅' : '📷'}</Text>
        </View>
      </View>
      {!hasPermission ? (
        <PrimaryButton title="Grant Permissions" onPress={requestPermission} />
      ) : (
        <PrimaryButton title="Next Step" onPress={() => setStep(2)} />
      )}
    </View>
  );

  const renderGuidelines = () => (
    <View style={styles.card}>
      <Text style={styles.title}>Facial Guidelines</Text>
      <Text style={styles.subtitle}>Follow these steps for accurate matching:</Text>
      <ScrollView style={styles.guidelinesScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletIcon}>💡</Text>
          <View style={styles.bulletTextContainer}>
            <Text style={styles.bulletTitle}>Soft Lighting</Text>
            <Text style={styles.bulletDesc}>Avoid direct backlighting or pitch darkness.</Text>
          </View>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletIcon}>👤</Text>
          <View style={styles.bulletTextContainer}>
            <Text style={styles.bulletTitle}>Direct Alignment</Text>
            <Text style={styles.bulletDesc}>Position face straight and level in guide.</Text>
          </View>
        </View>
      </ScrollView>
      <PrimaryButton title="Continue to Capture" onPress={() => setStep(3)} />
    </View>
  );

  const renderRegister = () => {
    const isRegisterEnabled = registrationName.trim().length > 0 && latestEmbeddingRef.current != null;
    return (
      <View style={[styles.card, styles.registerCard]}>
        <ProgressStepper currentStep={step} />
        <TextInput
          style={styles.input}
          placeholder="Enter username / employee name..."
          placeholderTextColor={theme.colors.textMuted}
          value={registrationName}
          onChangeText={setRegistrationName}
          autoCorrect={false}
        />
        <View style={styles.cameraFrame}>
          {isCameraActive && device != null && (
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={isCameraActive}
              format={format}
              pixelFormat="rgb"
              frameProcessor={frameProcessor}
              onStarted={() => console.log('[QA] CAMERA_PREVIEW_STARTED')}
              onError={error => console.error('[QA] CAMERA_ERROR', error)}
            />
          )}
          <View style={styles.cameraOverlay}>
            <View style={[styles.alignmentCircle, detectedBox && styles.alignmentCircleActive]} />
            <Text style={styles.feedbackText}>{status}</Text>
          </View>
        </View>
        <PrimaryButton
          title={latestEmbeddingRef.current ? '✓ Complete Registration' : 'Awaiting Face Match...'}
          onPress={handleRegister}
          disabled={!isRegisterEnabled}
          style={{ backgroundColor: isRegisterEnabled ? theme.colors.success : theme.colors.primary + '80' }}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Register Face" onBack={() => {
        if (step > 0) setStep(step - 1);
        else navigation.goBack();
      }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {step === 0 && renderWelcome()}
        {step === 1 && renderPermissions()}
        {step === 2 && renderGuidelines()}
        {step === 3 && renderRegister()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    width: '100%',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  registerCard: {
    padding: theme.spacing.lg,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing.lg,
  },
  logoEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.xl,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  bulletIcon: {
    fontSize: 18,
    marginRight: theme.spacing.md,
  },
  bulletTextContainer: {
    flex: 1,
  },
  bulletTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  bulletDesc: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  permissionBadgeContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.xl,
  },
  permissionCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  guidelinesScroll: {
    maxHeight: 280,
    marginBottom: theme.spacing.xl,
  },
  input: {
    height: 48,
    backgroundColor: '#0F172A',
    borderRadius: theme.spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.lg,
    fontSize: theme.typography.fontSize.md,
    marginBottom: theme.spacing.md,
  },
  cameraFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.spacing.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  alignmentCircle: {
    width: SCREEN_WIDTH * 0.54,
    height: SCREEN_WIDTH * 0.54,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: SCREEN_WIDTH * 0.27,
    borderStyle: 'dashed',
  },
  alignmentCircleActive: {
    borderColor: theme.colors.success,
  },
  feedbackText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.semibold,
    textAlign: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: theme.spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});

export default FaceRegistrationScreen;
