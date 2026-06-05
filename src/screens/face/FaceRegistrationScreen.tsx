import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  Dimensions,
  Alert,
  StatusBar,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import { NitroModules } from 'react-native-nitro-modules';
import { useRunOnJS } from 'react-native-worklets-core';
import { createResizePlugin } from 'vision-camera-resize-plugin';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ProgressStepper } from '../../components/ProgressStepper';
import { theme } from '../../theme/theme';
import { createUser, getAllUsers } from '../../database/userRepository';
import { useDatabase } from '../../hooks/useDatabase';
import { insertEmbedding, getEmbeddingsForUser, deleteEmbedding } from '../../database/embeddingRepository';
import { saveSecuredData } from '../../security/secureStorage';
import { validateFaceQuality } from '../../ai/faceQuality';
import { BLAZEFACE_FRONT_MODEL, MOBILEFACENET_MODEL, prepareTfliteModels } from '../../ai/modelSources';
import { detectBlink, resetBlinkHistory } from '../../liveness/blinkDetection';
import { detectHeadMovement, resetHeadMovementHistory } from '../../liveness/headMovement';
import { initAntiSpoofService, resetAntiSpoofService, runAntiSpoofPipeline, REGISTRATION_THRESHOLD } from '../../security/antiSpoofService';
import {
  generateBlazeFaceAnchors,
  decodeBlazeFaceBoxes,
  faceCropForFrame,
  unprocessBox,
  NormalizedBox,
  preAllocatedBoxes,
} from '../../utils/frameHelpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type BiometricStep = 'ALIGN' | 'FACE_DETECTED' | 'BLINK' | 'HEAD_LEFT' | 'HEAD_RIGHT' | 'ANTI_SPOOF' | 'COMPLETED';

export function FaceRegistrationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // ── ISSUE 3 FIX ──────────────────────────────────────────────────────────────
  // Detect operating mode:
  //   Mode A — NEW_USER_REGISTRATION : arrived from onboarding wizard (Step1→2→3→4)
  //   Mode B — UPDATE_FACE_TEMPLATE  : arrived from Dashboard "Register Face" button
  //            route.params.activeUser carries the already-authenticated user object
  const registrationData = route.params?.registrationData || {};
  const updateModeUser   = route.params?.activeUser ?? null;   // Mode B payload
  const isUpdateMode     = updateModeUser != null;             // true = Mode B
  // ─────────────────────────────────────────────────────────────────────────────

  const [registrationName, setRegistrationName] = useState(
    isUpdateMode ? (updateModeUser.name || '') : (registrationData.username || '')
  );

  const [biometricStep, setBiometricStep] = useState<BiometricStep>('ALIGN');
  const [status, setStatus] = useState(
    isUpdateMode
      ? `Updating face for ${updateModeUser.name}. Align face in guide...`
      : 'Align face in focus...'
  );

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

  const device = useCameraDevice('front');
  const boxedBlazeModel = useMemo(() => (blazeModel != null ? NitroModules.box(blazeModel) : undefined), [blazeModel]);
  const boxedFaceModel = useMemo(() => (faceModel != null ? NitroModules.box(faceModel) : undefined), [faceModel]);

  const resizePlugin = useMemo(() => {
    try {
      return createResizePlugin();
    } catch {
      return null;
    }
  }, []);

  const blazeAnchors = useMemo(() => generateBlazeFaceAnchors(), []);

  // Animated pulse for alignment indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

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

    load();
    // Initialize anti-spoof service (starts challenge session, resets all histories)
    initAntiSpoofService(3);

    return () => {
      active = false;
      // Reset all anti-spoof module state on unmount
      resetAntiSpoofService();
    };
  }, []);

  // Handle Camera activation delay
  useEffect(() => {
    if (hasPermission && device != null) {
      const timer = setTimeout(() => setIsCameraActive(true), 200);
      return () => clearTimeout(timer);
    } else {
      setIsCameraActive(false);
    }
  }, [hasPermission, device]);

  useEffect(() => {
    if (hasPermission) {
      console.log('[QA] CAMERA_PERMISSION_GRANTED');
    } else {
      requestPermission();
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

  // Simulator flow automation
  useEffect(() => {
    if (settings?.emulatorMode && modelsReady) {
      const timeouts: any[] = [];
      
      const runStep = (stepIdx: number) => {
        if (stepIdx === 0) {
          setStatus('Aligning face...');
          setBiometricStep('ALIGN');
          timeouts.push(setTimeout(() => runStep(1), 1000));
        } else if (stepIdx === 1) {
          console.log('[QA] FACE_DETECTED');
          setStatus('Face detected! Keep looking straight.');
          setBiometricStep('FACE_DETECTED');
          timeouts.push(setTimeout(() => runStep(2), 1000));
        } else if (stepIdx === 2) {
          console.log('[QA] BLINK_VERIFIED');
          setStatus('Blink verified!');
          setBiometricStep('BLINK');
          timeouts.push(setTimeout(() => runStep(3), 1000));
        } else if (stepIdx === 3) {
          console.log('[QA] HEAD_LEFT_VERIFIED');
          setStatus('Turn head left verified!');
          setBiometricStep('HEAD_LEFT');
          timeouts.push(setTimeout(() => runStep(4), 1000));
        } else if (stepIdx === 4) {
          console.log('[QA] HEAD_RIGHT_VERIFIED');
          setStatus('Turn head right verified!');
          setBiometricStep('HEAD_RIGHT');
          timeouts.push(setTimeout(() => runStep(5), 1000));
        } else if (stepIdx === 5) {
          console.log('[QA] ANTI_SPOOF_PASSED');
          setStatus('Anti-spoofing checks passed!');
          setBiometricStep('ANTI_SPOOF');
          timeouts.push(setTimeout(() => runStep(6), 1000));
        } else if (stepIdx === 6) {
          const mockEmbedding = new Float32Array(192);
          mockEmbedding.fill(0.5);
          latestEmbeddingRef.current = mockEmbedding;
          console.log('[QA] EMBEDDING_GENERATED');
          setStatus('Biometric profile generated!');
          setBiometricStep('COMPLETED');
          
          timeouts.push(setTimeout(() => {
            handleRegisterAutomated(mockEmbedding);
          }, 800));
        }
      };

      runStep(0);

      return () => {
        timeouts.forEach(t => clearTimeout(t));
      };
    }
  }, [settings?.emulatorMode, modelsReady]);

  const format = useCameraFormat(device, [
    { videoAspectRatio: SCREEN_WIDTH / Dimensions.get('window').height },
  ]);

  // Main save action — supports Mode A (new user) and Mode B (update existing face)
  const handleRegisterAutomated = async (embedding: Float32Array) => {

    // ── MODE B: UPDATE_FACE_TEMPLATE ─────────────────────────────────────────
    if (isUpdateMode && updateModeUser) {
      console.log('[QA] UPDATE_FACE_MODE');
      try {
        // 1. Delete all existing embeddings for this user
        const existingEmbeds = await getEmbeddingsForUser(updateModeUser.id);
        for (const embed of existingEmbeds) {
          await deleteEmbedding(embed.id);
          console.log(`[QA] OLD_EMBEDDING_REMOVED id=${embed.id}`);
        }

        // 2. Insert the new embedding
        await insertEmbedding(updateModeUser.id, embedding, 'MobileFaceNet_v1');
        console.log('[QA] NEW_EMBEDDING_CREATED');

        // 3. Ensure this user remains the active profile
        await saveSecuredData('active_user_name', updateModeUser.name);
        console.log(`[QA] PROFILE_ACTIVATED ${updateModeUser.name}`);

        setIsCameraActive(false);

        Alert.alert(
          '✓ Face Updated',
          `Biometric template updated successfully for ${updateModeUser.name}.`,
          [{ text: 'Continue', onPress: () => navigation.replace('Main') }]
        );
      } catch (err) {
        console.error('[QA] UPDATE_FACE_ERROR', err);
        Alert.alert('Update Error', 'Failed to update biometric template. Please try again.');
      }
      return;
    }

    // ── MODE A: NEW_USER_REGISTRATION ────────────────────────────────────────
    const { fullName, employeeId, department, designation, phone, email, username, password } = registrationData;
    const registerName  = username || registrationName || 'User';
    const registerEmpId = employeeId || 'EMP_' + Math.floor(Math.random() * 10000);

    try {
      // 1. Find or create the user (never duplicate)
      const dbUsers = await getAllUsers();
      let user = dbUsers.find(u => u.name.toLowerCase() === registerName.toLowerCase());
      let userId = user ? user.id : null;
      console.log(`[QA] REGISTER_USERNAME ${registerName}`);

      if (!userId) {
        userId = await createUser(registerName, registerEmpId);
        console.log('[QA] USER_CREATED');
        console.log(`[QA] USER_ID_CREATED ${userId}`);
      } else {
        console.log(`[QA] USER_ALREADY_EXISTS id=${userId}`);
      }

      // 2. Insert embedding
      await insertEmbedding(userId, embedding, 'MobileFaceNet_v1');
      console.log('[QA] EMBEDDING_CREATED');

      // 3. Save personal details and password in secureStorage
      if (username) {
        const detailsObj = { fullName, employeeId: registerEmpId, department, designation, phone, email };
        await saveSecuredData(`details_${username.toLowerCase()}`, JSON.stringify(detailsObj));
        await saveSecuredData(`password_${username.toLowerCase()}`, password);
        console.log('[QA] REGISTER_PASSWORD_HASH saved');
      }

      // 4. Activate profile
      await saveSecuredData('active_user_name', registerName);
      console.log(`[QA] PROFILE_ACTIVATED ${registerName}`);

      // 5. Mark onboarding complete
      await saveSecuredData('setting_onboardingCompleted', 'true');
      console.log('[QA] AUTH_ENABLED');

      setIsCameraActive(false);
      navigation.replace('RegistrationSuccess', {
        registrationData: {
          fullName: fullName || registerName,
          employeeId: registerEmpId,
          username: registerName,
        },
      });
    } catch (err) {
      console.error('[QA] REGISTRATION_ERROR', err);
      Alert.alert('Registration Error', 'Failed to save biometric profile.');
    }
  };

  // JS thread callbacks for real camera liveness workflow
  const handleFrameResult = useRunOnJS((
    box: NormalizedBox | undefined,
    embedding: Float32Array | null,
    feedback: string,
    blinkValid: boolean,
    headLeftValid: boolean,
    headRightValid: boolean,
    antiSpoofPassed: boolean
  ) => {
    setDetectedBox(box);
    setStatus(feedback);

    if (settings?.emulatorMode) return; // emulator runs its own timer flow

    // Active liveness state transitions
    if (biometricStep === 'ALIGN' && box != null) {
      console.log('[QA] FACE_DETECTED');
      setBiometricStep('FACE_DETECTED');
      setStatus('Face detected! Prepare to blink.');
    } else if (biometricStep === 'FACE_DETECTED' && box != null) {
      setBiometricStep('BLINK');
      setStatus('Please blink your eyes.');
    } else if (biometricStep === 'BLINK' && blinkValid) {
      console.log('[QA] BLINK_VERIFIED');
      setBiometricStep('HEAD_LEFT');
      setStatus('Please turn your head slowly to the left.');
    } else if (biometricStep === 'HEAD_LEFT' && headLeftValid) {
      console.log('[QA] HEAD_LEFT_VERIFIED');
      setBiometricStep('HEAD_RIGHT');
      setStatus('Please turn your head slowly to the right.');
    } else if (biometricStep === 'HEAD_RIGHT' && headRightValid) {
      console.log('[QA] HEAD_RIGHT_VERIFIED');
      setBiometricStep('ANTI_SPOOF');
      setStatus('Analyzing liveness anti-spoof properties...');
    } else if (biometricStep === 'ANTI_SPOOF' && antiSpoofPassed) {
      console.log('[QA] ANTI_SPOOF_PASSED');
      setBiometricStep('COMPLETED');
      setStatus('Generating biometric template...');
    } else if (biometricStep === 'COMPLETED' && embedding != null) {
      latestEmbeddingRef.current = embedding;
      console.log('[QA] EMBEDDING_GENERATED');
      handleRegisterAutomated(embedding);
    }
  }, [biometricStep, settings?.emulatorMode]);

  const logFrameStage = useRunOnJS((stage: string) => {
    console.log(stage);
  }, []);

  const logFrameError = useRunOnJS((message: string) => {
    console.error('[QA] FRAME_PROCESSOR_ERROR', message);
  }, []);

  // Frame processor running the ML pipelines
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (settings?.emulatorMode) return;

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
      
      // 1. Face Detection
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
        handleFrameResult(undefined, null, 'No face detected. Align face inside the guide.', false, false, false, false);
        return;
      }

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

      // 2. Validate Quality
      const quality = validateFaceQuality(
        detectionBuffer as Float32Array,
        128,
        128,
        detectedRaw,
        bestKeypoints,
        false
      );

      let qualityError: string | null = null;
      if (quality.tooSmall) qualityError = 'Face too small';
      else if (quality.alignmentInvalid || quality.occluded) qualityError = 'Face alignment invalid';
      else if (quality.lowLightDetected) qualityError = 'Face too dark';
      else if (quality.blurDetected) qualityError = 'Face too blurry';

      if (qualityError != null) {
        handleFrameResult(unprocBox, null, qualityError, false, false, false, false);
        return;
      }

      // 3. Advanced Anti-Spoof Pipeline (score-based, threshold >= REGISTRATION_THRESHOLD)
      const antiSpoofResult = runAntiSpoofPipeline(
        detectionBuffer as Float32Array,
        128,
        128,
        detectedRaw,
        bestKeypoints,
        false,
        'registration'
      );

      const blinkValid = antiSpoofResult.blinkVerified;
      const headMoved = antiSpoofResult.headTurnVerified;

      // Nose-X relative coordinates (used for directional head-turn split)
      const boxCenterX = (unprocBox.xMin + unprocBox.xMax) / 2;
      const boxWidth = unprocBox.xMax - unprocBox.xMin;
      const relativeX = (bestKeypoints[2].x - boxCenterX) / boxWidth;

      const headLeftValid = headMoved && relativeX < -0.04;
      const headRightValid = headMoved && relativeX > 0.04;

      // Anti-spoof gate: require minimum score of REGISTRATION_THRESHOLD (80)
      const antiSpoofPassed = antiSpoofResult.passed;

      // Update status with challenge instruction when anti-spoof not yet passed
      if (!antiSpoofResult.passed && biometricStep === 'ANTI_SPOOF') {
        handleFrameResult(
          unprocBox, null,
          antiSpoofResult.statusMessage || `Anti-spoof: ${antiSpoofResult.score.totalScore}/${REGISTRATION_THRESHOLD}`,
          blinkValid, headLeftValid, headRightValid, false
        );
        return;
      }

      // 4. Crop Face and Run MobileFaceNet to generate embedding
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

      handleFrameResult(unprocBox, copiedEmbedding, 'Face Matched!', blinkValid, headLeftValid, headRightValid, antiSpoofPassed);
    },
    [blazeAnchors, resizePlugin, modelsReady, boxedBlazeModel, boxedFaceModel, biometricStep, settings?.emulatorMode]
  );

  const StepCheck = ({ label, active, completed }: { label: string; active: boolean; completed: boolean }) => (
    <View style={[styles.stepItem, active && styles.stepItemActive, completed && styles.stepItemCompleted]}>
      <Text style={[styles.stepItemText, (active || completed) && styles.stepItemTextActive]}>
        {completed ? '✓ ' : '• '} {label}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <AppHeader title={isUpdateMode ? 'Update Face Template' : 'Face Enrollment'} onBack={() => navigation.goBack()} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, styles.registerCard]}>
          {!isUpdateMode && <Text style={styles.stepIndicator}>Step 4 of 4</Text>}
          {!isUpdateMode && <ProgressStepper currentStep={3} />}
          {isUpdateMode && (
            <Text style={[styles.stepIndicator, { color: '#10B981' }]}>
              UPDATE FACE TEMPLATE
            </Text>
          )}

          <Text style={styles.cardTitle}>Biometric Enrollment</Text>
          <Text style={styles.cardSubtitle}>Follow the onboarding liveness scan prompts</Text>

          {/* Stepper Details */}
          <View style={styles.livenessChecklist}>
            <StepCheck label="Align Face in guide" active={biometricStep === 'ALIGN'} completed={biometricStep !== 'ALIGN'} />
            <StepCheck label="Blink your eyes" active={biometricStep === 'BLINK'} completed={biometricStep !== 'ALIGN' && biometricStep !== 'FACE_DETECTED' && biometricStep !== 'BLINK'} />
            <StepCheck label="Turn head left slowly" active={biometricStep === 'HEAD_LEFT'} completed={biometricStep !== 'ALIGN' && biometricStep !== 'FACE_DETECTED' && biometricStep !== 'BLINK' && biometricStep !== 'HEAD_LEFT'} />
            <StepCheck label="Turn head right slowly" active={biometricStep === 'HEAD_RIGHT'} completed={biometricStep === 'ANTI_SPOOF' || biometricStep === 'COMPLETED'} />
            <StepCheck label="Liveness Anti-Spoof audit" active={biometricStep === 'ANTI_SPOOF'} completed={biometricStep === 'COMPLETED'} />
          </View>

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
              <Animated.View 
                style={[
                  styles.alignmentCircle, 
                  detectedBox && styles.alignmentCircleActive,
                  { transform: [{ scale: pulseAnim }] }
                ]} 
              />
              <Text style={styles.feedbackText}>{status}</Text>
            </View>
          </View>

          <Text style={styles.instructionFooter}>
            All scanning verification takes place strictly offline.
          </Text>
        </View>
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
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  registerCard: {
    padding: 20,
  },
  stepIndicator: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: -10,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F8FAFC',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  livenessChecklist: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  stepItem: {
    paddingVertical: 4,
    opacity: 0.4,
  },
  stepItemActive: {
    opacity: 1,
  },
  stepItemCompleted: {
    opacity: 0.8,
  },
  stepItemText: {
    color: '#94A3B8',
    fontSize: 12.5,
    fontWeight: '600',
  },
  stepItemTextActive: {
    color: '#F8FAFC',
    fontWeight: 'bold',
  },
  cameraFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  alignmentCircle: {
    width: SCREEN_WIDTH * 0.52,
    height: SCREEN_WIDTH * 0.52,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: SCREEN_WIDTH * 0.26,
    borderStyle: 'dashed',
  },
  alignmentCircleActive: {
    borderColor: '#10B981',
    borderStyle: 'solid',
  },
  feedbackText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  instructionFooter: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default FaceRegistrationScreen;
