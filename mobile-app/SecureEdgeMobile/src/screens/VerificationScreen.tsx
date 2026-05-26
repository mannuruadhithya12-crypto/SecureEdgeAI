import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scaleFont } from '../utils/layout';

const SCREEN_WIDTH = Dimensions.get('window').width;

type AuthState = 'IDLE' | 'SCANNING' | 'DETECTING' | 'VERIFYING' | 'AUTHENTICATED' | 'REJECTED';

interface User {
  id: number;
  name: string;
  created_at: string;
}

interface VerificationScreenProps {
  currentScreen: string;
  setCurrentScreen: (screen: 'Verification' | 'Profiles' | 'Settings') => void;
  authState: AuthState;
  statusText: string;
  detectedBox: any;
  authScore: number;
  authenticatedUser: string | null;
  activeUser: User | null;
  livenessBlink: boolean;
  livenessHead: boolean;
  rollingScores: number[];
  sessionActive: boolean;
  lockoutTimeLeft: number;
  // Performance and hardener states
  devFps: number;
  devInferenceMs: number;
  devMemoryMb: number;
  hardeningRoot: boolean;
  hardeningDebugger: boolean;
  hardeningIntegrity: boolean;
  // Settings
  cameraPosition: 'front' | 'back';
  telemetryEnabled: boolean;
  isDarkMode: boolean;
  // Empty states support (CHANGE-7)
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  cameraUnavailable: boolean;
  onRegisterPressed: () => void;
}

export function VerificationScreen({
  currentScreen,
  setCurrentScreen,
  authState,
  statusText,
  detectedBox,
  authScore,
  authenticatedUser,
  activeUser,
  livenessBlink,
  livenessHead,
  rollingScores,
  sessionActive: _sessionActive,
  lockoutTimeLeft,
  devFps,
  devInferenceMs,
  devMemoryMb,
  hardeningRoot,
  hardeningDebugger,
  hardeningIntegrity,
  cameraPosition,
  telemetryEnabled,
  isDarkMode,
  hasPermission,
  requestPermission,
  cameraUnavailable,
  onRegisterPressed,
}: VerificationScreenProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Animation values (CHANGE-4)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successScaleAnim = useRef(new Animated.Value(0.8)).current;
  const successOpacityAnim = useRef(new Animated.Value(0)).current;
  const toastYAnim = useRef(new Animated.Value(-50)).current;
  const toastOpacityAnim = useRef(new Animated.Value(0)).current;

  // Colors
  const colors = {
    background: 'transparent',
    card: isDarkMode ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.9)',
    text: isDarkMode ? '#F8FAFC' : '#0F172A',
    textMuted: isDarkMode ? '#94A3B8' : '#64748B',
    primary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  };

  // Face guide pulse animation (Breathing effect)
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if ((authState === 'SCANNING' || authState === 'VERIFYING') && hasPermission && !cameraUnavailable && activeUser != null) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.98,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [authState, pulseAnim, activeUser, cameraUnavailable, hasPermission]);

  // Success badge entry animation
  useEffect(() => {
    if (authState === 'AUTHENTICATED') {
      successScaleAnim.setValue(0.85);
      successOpacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(successScaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(successOpacityAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [authState, successOpacityAnim, successScaleAnim]);

  // Toast animation when status message changes (CHANGE-7)
  const isQualityWarning =
    statusText.includes('too') ||
    statusText.includes('Align') ||
    statusText.includes('Center') ||
    statusText.includes('Hold') ||
    statusText.includes('Multiple') ||
    statusText.includes('mismatch') ||
    statusText.includes('locked');

  useEffect(() => {
    if (statusText) {
      toastYAnim.setValue(-15);
      toastOpacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(toastYAnim, {
          toValue: 0,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(toastOpacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [statusText, toastOpacityAnim, toastYAnim]);


  // Bounding box responsive calibration (CHANGE-8)
  const renderBoundingBox = () => {
    if (detectedBox == null || lockoutTimeLeft > 0 || authState === 'AUTHENTICATED' || !hasPermission || cameraUnavailable || activeUser == null) {
      return null;
    }

    const parentWidth = windowWidth;
    const parentHeight = windowHeight;
    const isMirrored = cameraPosition === 'front';

    // Mirrored coordinates mapping
    const left = isMirrored
      ? (1 - detectedBox.xMax) * parentWidth
      : detectedBox.xMin * parentWidth;
    const top = detectedBox.yMin * parentHeight;
    const boxWidth = (detectedBox.xMax - detectedBox.xMin) * parentWidth;
    const boxHeight = (detectedBox.yMax - detectedBox.yMin) * parentHeight;

    const boxBorderColor =
      authState === 'VERIFYING'
        ? colors.warning
        : authState === 'REJECTED'
        ? colors.danger
        : colors.primary;

    return (
      <View
        style={[
          styles.boundingBox,
          {
            left: Math.max(0, left),
            top: Math.max(0, top),
            width: Math.min(boxWidth, parentWidth - left),
            height: Math.min(boxHeight, parentHeight - top),
            borderColor: boxBorderColor,
          },
        ]}
      >
        <View style={[styles.boxCorner, styles.cornerTopLeft, { borderColor: boxBorderColor }]} />
        <View style={[styles.boxCorner, styles.cornerTopRight, { borderColor: boxBorderColor }]} />
        <View style={[styles.boxCorner, styles.cornerBottomLeft, { borderColor: boxBorderColor }]} />
        <View style={[styles.boxCorner, styles.cornerBottomRight, { borderColor: boxBorderColor }]} />
      </View>
    );
  };

  // Compute validation percentage bar (CHANGE-1)
  const validFramesCount = rollingScores.filter(s => s > 0.85).length;
  const progressPercent = Math.min(100, Math.round((validFramesCount / 3) * 100));

  const renderEmptyState = () => {
    if (!hasPermission) {
      return (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.emptyIcon}>🚫</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Camera Permission Denied</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            Camera access is required for real-time face matching and liveness verification.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel="Grant camera permission"
          >
            <Text style={styles.emptyButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (cameraUnavailable) {
      return (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Camera Unavailable</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            No camera device was detected. If you are using an emulator, verify virtual camera hardware is enabled.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setCurrentScreen('Settings')}
            accessibilityRole="button"
            accessibilityLabel="Go to Settings"
          >
            <Text style={styles.emptyButtonText}>Go to Settings</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeUser == null) {
      return (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Registered Users</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            Please register a new face profile to start using biometric authentication on this device.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={onRegisterPressed}
            accessibilityRole="button"
            accessibilityLabel="Register new user profile"
          >
            <Text style={styles.emptyButtonText}>Register Now</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  const showScannerUI = hasPermission && !cameraUnavailable && activeUser != null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 1. Camera bounding box overlay */}
      {renderBoundingBox()}

      {/* 2. Primary Scan UI container */}
      <View style={[styles.overlayContainer, { paddingTop: Math.max(10, insets.top), paddingBottom: Math.max(10, insets.bottom) }]} pointerEvents="box-none">
        
        {/* Empty state views (CHANGE-7) */}
        {!showScannerUI ? renderEmptyState() : null}

        {/* Floating warning toasts (CHANGE-7) */}
        {statusText && isQualityWarning && authState !== 'AUTHENTICATED' && lockoutTimeLeft === 0 && showScannerUI ? (
          <Animated.View
            style={[
              styles.warningToast,
              {
                opacity: toastOpacityAnim,
                transform: [{ translateY: toastYAnim }],
              },
            ]}
          >
            <Text style={styles.warningToastText}>
              ⚠️ {statusText}
            </Text>
          </Animated.View>
        ) : null}

        {/* Dynamic status badge (General updates) */}
        {statusText && !isQualityWarning && authState !== 'AUTHENTICATED' && lockoutTimeLeft === 0 && showScannerUI ? (
          <View style={styles.statusBadge}>
            <Text style={[styles.statusText, { color: isDarkMode ? '#FFF' : '#0F172A' }]}>
              {statusText}
            </Text>
          </View>
        ) : null}

        {/* Lockout overlay (CHANGE-5, CHANGE-9) */}
        {lockoutTimeLeft > 0 ? (
          <View style={styles.lockoutContainer}>
            <View style={[styles.lockoutCard, { backgroundColor: colors.card }]}>
              <Text style={{ fontSize: scaleFont(42) }}>🔒</Text>
              <Text style={[styles.lockoutTitle, { color: colors.danger }]}>Security Lockout Active</Text>
              <Text style={[styles.lockoutDesc, { color: colors.textMuted }]}>
                Too many failed authentication attempts for {activeUser?.name || 'Active profile'}. Enforcing safety cooling.
              </Text>
              <View style={styles.timerBadge}>
                <Text style={styles.timerText}>Try again in {lockoutTimeLeft}s</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* 3. Successful Verification overlay (CHANGE-1, CHANGE-4) */}
        {authState === 'AUTHENTICATED' && lockoutTimeLeft === 0 ? (
          <View style={styles.successContainer}>
            <Animated.View
              style={[
                styles.successCard,
                {
                  opacity: successOpacityAnim,
                  transform: [{ scale: successScaleAnim }],
                  backgroundColor: colors.card,
                  borderColor: colors.success,
                },
              ]}
            >
              <View style={styles.successCircle}>
                <Text style={styles.successIcon}>✓</Text>
              </View>
              <Text style={[styles.successTitle, { color: colors.success }]}>Face Verified</Text>
              <Text style={[styles.successSubtitle, { color: colors.text }]}>
                Welcome back, {authenticatedUser || activeUser?.name || 'User'}
              </Text>
              <Text style={styles.successScore}>
                Similarity Score: {(authScore * 100).toFixed(0)}%
              </Text>
            </Animated.View>
          </View>
        ) : null}

        {/* Circular Face Guide with Pulse (Breathing effect) (CHANGE-8) */}
        {lockoutTimeLeft === 0 && authState !== 'AUTHENTICATED' && showScannerUI ? (
          <View style={styles.guideContainer} pointerEvents="none">
            <Animated.View
              style={[
                styles.guideBox,
                {
                  transform: [{ scale: pulseAnim }],
                  borderColor:
                    authState === 'VERIFYING'
                      ? colors.warning
                      : authState === 'REJECTED'
                      ? colors.danger
                      : 'rgba(255, 255, 255, 0.45)',
                },
              ]}
            />
          </View>
        ) : null}

        {/* 4. Controls, Telemetry & Navigation */}
        <View style={styles.bottomSection} pointerEvents="box-none">
          
          {/* Telemetry HUD display (CHANGE-5, CHANGE-7) */}
          {telemetryEnabled ? (
            <View style={[styles.telemetryHud, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.92)' }]}>
              <Text style={styles.telemetryText}>
                📊 FPS: {devFps} | Infer: {devInferenceMs}ms | RAM: {devMemoryMb}MB
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.telemetryHud, { opacity: 0.6, backgroundColor: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' }]}
              onPress={() => setCurrentScreen('Settings')}
              accessibilityRole="button"
              accessibilityLabel="Enable telemetry settings"
            >
              <Text style={[styles.telemetryText, { color: colors.textMuted }]}>
                📊 Stats Off (Tap to configure)
              </Text>
            </TouchableOpacity>
          )}

          {/* Verification checklist / progress indicators */}
          {lockoutTimeLeft === 0 && authState !== 'AUTHENTICATED' && showScannerUI ? (
            <View style={[styles.checkListContainer, { backgroundColor: colors.card }]}>
              <Text style={[styles.checklistTitle, { color: colors.text }]}>
                Biometric Audits: {activeUser.name}
              </Text>
              <View style={styles.checklistRow}>
                <Text style={[styles.checkItem, { color: livenessBlink ? colors.success : colors.textMuted }]}>
                  {livenessBlink ? '✅ Blink' : '❌ Blink'}
                </Text>
                <Text style={[styles.checkItem, { color: livenessHead ? colors.success : colors.textMuted }]}>
                  {livenessHead ? '✅ Head Turn' : '❌ Head Turn'}
                </Text>
                <Text style={[styles.checkItem, { color: validFramesCount >= 3 ? colors.success : colors.textMuted }]}>
                  {validFramesCount >= 3 ? '✅ Matching' : `⏳ Match (${validFramesCount}/3)`}
                </Text>
              </View>
              {/* Progress bar */}
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: progressPercent === 100 ? colors.success : colors.primary,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}

          {/* Native hardening indicators */}
          <View style={styles.hardeningRow}>
            <Text style={[styles.hardeningText, { color: hardeningRoot ? '#EF4444' : '#10B981' }]}>
              🛡️ Root: {hardeningRoot ? 'UNSECURE' : 'SECURE'}
            </Text>
            <Text style={[styles.hardeningText, { color: hardeningDebugger ? '#EF4444' : '#10B981' }]}>
              🐞 Debugger: {hardeningDebugger ? 'ATTACHED' : 'SECURE'}
            </Text>
            <Text style={[styles.hardeningText, { color: !hardeningIntegrity ? '#EF4444' : '#10B981' }]}>
              📦 APK: {hardeningIntegrity ? 'OK' : 'TAMPERED'}
            </Text>
          </View>

          {/* Elegant Custom Bottom Navigation Bar (CHANGE-1, CHANGE-10) */}
          <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.tabButton}
              onPress={() => setCurrentScreen('Verification')}
              accessibilityRole="button"
              accessibilityState={{ selected: currentScreen === 'Verification' }}
              accessibilityLabel="Navigate to biometric scanner"
            >
              <Text style={[styles.tabIcon, currentScreen === 'Verification' && styles.tabIconActive]}>
                📷
              </Text>
              <Text style={[styles.tabLabel, { color: colors.text }, currentScreen === 'Verification' && styles.tabLabelActive]}>
                Scan
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabButton}
              onPress={() => setCurrentScreen('Profiles')}
              accessibilityRole="button"
              accessibilityState={{ selected: currentScreen === 'Profiles' }}
              accessibilityLabel="Navigate to profiles database"
            >
              <Text style={[styles.tabIcon, currentScreen === 'Profiles' && styles.tabIconActive]}>
                👥
              </Text>
              <Text style={[styles.tabLabel, { color: colors.text }, currentScreen === 'Profiles' && styles.tabLabelActive]}>
                Profiles
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabButton}
              onPress={() => setCurrentScreen('Settings')}
              accessibilityRole="button"
              accessibilityState={{ selected: currentScreen === 'Settings' }}
              accessibilityLabel="Navigate to system settings"
            >
              <Text style={[styles.tabIcon, currentScreen === 'Settings' && styles.tabIconActive]}>
                ⚙️
              </Text>
              <Text style={[styles.tabLabel, { color: colors.text }, currentScreen === 'Settings' && styles.tabLabelActive]}>
                Settings
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 5,
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 8,
    zIndex: 10,
  },
  boxCorner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderWidth: 3,
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 6,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 6,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 6,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 6,
  },
  warningToast: {
    backgroundColor: '#F59E0B',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    alignSelf: 'center',
    maxWidth: '90%',
  },
  warningToastText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center',
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.76)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 20,
    maxWidth: '95%',
    alignSelf: 'center',
  },
  statusText: {
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  guideContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideBox: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: SCREEN_WIDTH * 0.35,
    borderStyle: 'dashed',
  },
  lockoutContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
    paddingHorizontal: 20,
  },
  lockoutCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  lockoutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  lockoutDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  timerBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timerText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 14,
  },
  successContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(9, 13, 26, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
    paddingHorizontal: 20,
  },
  successCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 2,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIcon: {
    color: '#10B981',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: Platform.OS === 'ios' ? 0 : -2,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  successScore: {
    fontSize: 12,
    color: 'rgba(16, 185, 129, 0.9)',
    fontWeight: '600',
  },
  bottomSection: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  telemetryHud: {
    alignSelf: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  telemetryText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '700',
  },
  checkListContainer: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    width: '100%',
  },
  checklistTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  checklistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  checkItem: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    width: '100%',
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },
  hardeningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  hardeningText: {
    fontSize: 9,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    width: '100%',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minHeight: 44,
  },
  tabIcon: {
    fontSize: 18,
    opacity: 0.4,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.5,
  },
  tabLabelActive: {
    color: '#3B82F6',
    opacity: 1,
  },
  emptyCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    alignSelf: 'center',
    marginVertical: 40,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
