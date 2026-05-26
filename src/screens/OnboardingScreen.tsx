import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { scaleFont, scaleSpacing, isTablet } from '../utils/layout';
import { SafeAreaView } from 'react-native-safe-area-context';

interface OnboardingScreenProps {
  step: number;
  setStep: (step: number) => void;
  registrationName: string;
  setRegistrationName: (name: string) => void;
  handleRegister: () => void;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  status: string;
  detectedBox: any;
  latestEmbedding: any;
  isDarkMode: boolean;
}

export function OnboardingScreen({
  step,
  setStep,
  registrationName,
  setRegistrationName,
  handleRegister,
  hasPermission,
  requestPermission,
  status,
  detectedBox,
  latestEmbedding,
  isDarkMode,
}: OnboardingScreenProps) {
  
  const colors = {
    background: isDarkMode ? '#090D1A' : '#F8FAFC',
    card: isDarkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.9)',
    text: isDarkMode ? '#F8FAFC' : '#0F172A',
    textMuted: isDarkMode ? '#94A3B8' : '#64748B',
    primary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: scaleSpacing(20),
    },
    card: {
      width: '100%',
      maxWidth: isTablet ? 540 : undefined,
      backgroundColor: colors.card,
      borderRadius: scaleSpacing(16),
      borderWidth: 1,
      borderColor: colors.border,
      padding: scaleSpacing(24),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDarkMode ? 0.3 : 0.08,
      shadowRadius: 12,
      elevation: 5,
    },
    title: {
      fontSize: scaleFont(24),
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: scaleSpacing(12),
    },
    subtitle: {
      fontSize: scaleFont(14),
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: scaleFont(20),
      marginBottom: scaleSpacing(24),
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: scaleSpacing(16),
    },
    bulletIcon: {
      fontSize: scaleFont(20),
      marginRight: scaleSpacing(12),
      marginTop: Platform.OS === 'ios' ? 0 : 2,
    },
    bulletTextContainer: {
      flex: 1,
    },
    bulletTitle: {
      fontSize: scaleFont(15),
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: scaleSpacing(2),
    },
    bulletDesc: {
      fontSize: scaleFont(13),
      color: colors.textMuted,
      lineHeight: scaleFont(18),
    },
    button: {
      backgroundColor: colors.primary,
      height: Math.max(44, scaleSpacing(48)),
      borderRadius: scaleSpacing(12),
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: scaleSpacing(16),
      width: '100%',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: scaleFont(15),
      fontWeight: 'bold',
    },
    secondaryButton: {
      height: Math.max(44, scaleSpacing(48)),
      borderRadius: scaleSpacing(12),
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: scaleSpacing(12),
      width: '100%',
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: scaleFont(15),
      fontWeight: '600',
    },
    input: {
      height: Math.max(44, scaleSpacing(48)),
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
      borderRadius: scaleSpacing(8),
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      paddingHorizontal: scaleSpacing(16),
      fontSize: scaleFont(15),
      marginBottom: scaleSpacing(16),
    },
    cameraPreviewPlaceholder: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: scaleSpacing(12),
      overflow: 'hidden',
      marginBottom: scaleSpacing(16),
      backgroundColor: '#000000',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cameraOverlay: {
      ...StyleSheet.absoluteFill,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    guideCircle: {
      width: '75%',
      aspectRatio: 1,
      borderWidth: 2,
      borderRadius: 999,
      borderColor: detectedBox ? colors.success : 'rgba(255, 255, 255, 0.4)',
      borderStyle: 'dashed',
    },
    feedbackText: {
      color: '#FFFFFF',
      fontSize: scaleFont(14),
      fontWeight: '600',
      textAlign: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      paddingHorizontal: scaleSpacing(14),
      paddingVertical: scaleSpacing(6),
      borderRadius: scaleSpacing(20),
      marginTop: scaleSpacing(12),
      overflow: 'hidden',
    },
    statusText: {
      fontSize: scaleFont(13),
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: scaleSpacing(8),
    },
  });

  const renderWelcome = () => (
    <View style={dynamicStyles.card}>
      <Text style={dynamicStyles.title}>SecureEdgeAI</Text>
      <Text style={dynamicStyles.subtitle}>
        On-Device Biometric Verification & Hardware Harden Security System
      </Text>

      <View style={dynamicStyles.bulletRow}>
        <Text style={dynamicStyles.bulletIcon}>🛡️</Text>
        <View style={dynamicStyles.bulletTextContainer}>
          <Text style={dynamicStyles.bulletTitle}>100% On-Device AI</Text>
          <Text style={dynamicStyles.bulletDesc}>
            Facial embeddings are generated, encrypted, and matched entirely locally. Your data never leaves this device.
          </Text>
        </View>
      </View>

      <View style={dynamicStyles.bulletRow}>
        <Text style={dynamicStyles.bulletIcon}>👁️</Text>
        <View style={dynamicStyles.bulletTextContainer}>
          <Text style={dynamicStyles.bulletTitle}>Liveness Verification</Text>
          <Text style={dynamicStyles.bulletDesc}>
            Anti-spoofing engine checks blink patterns and head rotation to reject photos and videos.
          </Text>
        </View>
      </View>

      <View style={dynamicStyles.bulletRow}>
        <Text style={dynamicStyles.bulletIcon}>🔒</Text>
        <View style={dynamicStyles.bulletTextContainer}>
          <Text style={dynamicStyles.bulletTitle}>Hardened Security</Text>
          <Text style={dynamicStyles.bulletDesc}>
            Continuous checks for rooted kernels, active debuggers, and application package tampering.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={dynamicStyles.button}
        onPress={() => setStep(1)}
        accessibilityRole="button"
        accessibilityLabel="Get Started with onboarding"
      >
        <Text style={dynamicStyles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPermissions = () => (
    <View style={dynamicStyles.card}>
      <Text style={dynamicStyles.title}>Camera Access</Text>
      <Text style={dynamicStyles.subtitle}>
        We require camera access to perform on-device real-time facial feature extraction and liveness checks.
      </Text>

      <View style={{ alignItems: 'center', marginVertical: scaleSpacing(20) }}>
        <View
          style={{
            width: scaleSpacing(80),
            height: scaleSpacing(80),
            borderRadius: scaleSpacing(40),
            backgroundColor: hasPermission
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(59, 130, 246, 0.1)',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: hasPermission ? colors.success : colors.primary,
          }}
        >
          <Text style={{ fontSize: scaleFont(32) }}>
            {hasPermission ? '✅' : '📷'}
          </Text>
        </View>
        <Text
          style={[
            dynamicStyles.bulletTitle,
            { marginTop: scaleSpacing(12), color: hasPermission ? colors.success : colors.text },
          ]}
        >
          {hasPermission ? 'Permission Granted' : 'Camera Access Needed'}
        </Text>
      </View>

      {!hasPermission ? (
        <TouchableOpacity
          style={dynamicStyles.button}
          onPress={async () => {
            await requestPermission();
          }}
          accessibilityRole="button"
          accessibilityLabel="Grant camera permission"
        >
          <Text style={dynamicStyles.buttonText}>Grant Access</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={dynamicStyles.button}
          onPress={() => setStep(2)}
          accessibilityRole="button"
          accessibilityLabel="Continue to next step"
        >
          <Text style={dynamicStyles.buttonText}>Next Step</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderGuidelines = () => (
    <View style={dynamicStyles.card}>
      <Text style={dynamicStyles.title}>Optimal Scan Setup</Text>
      <Text style={dynamicStyles.subtitle}>
        For clean biometric extraction, follow these guidelines:
      </Text>

      <ScrollView style={{ maxHeight: scaleSpacing(260) }} showsVerticalScrollIndicator={false}>
        <View style={dynamicStyles.bulletRow}>
          <Text style={dynamicStyles.bulletIcon}>💡</Text>
          <View style={dynamicStyles.bulletTextContainer}>
            <Text style={dynamicStyles.bulletTitle}>Balanced Lighting</Text>
            <Text style={dynamicStyles.bulletDesc}>
              Avoid heavy backlit scenes or pitch-black environments. Front-facing soft light yields the best recognition.
            </Text>
          </View>
        </View>

        <View style={dynamicStyles.bulletRow}>
          <Text style={dynamicStyles.bulletIcon}>👤</Text>
          <View style={dynamicStyles.bulletTextContainer}>
            <Text style={dynamicStyles.bulletTitle}>Face Alignment</Text>
            <Text style={dynamicStyles.bulletDesc}>
              Look straight ahead into the device camera. Align your face inside the bounding box guidelines.
            </Text>
          </View>
        </View>

        <View style={dynamicStyles.bulletRow}>
          <Text style={dynamicStyles.bulletIcon}>⏱️</Text>
          <View style={dynamicStyles.bulletTextContainer}>
            <Text style={dynamicStyles.bulletTitle}>Liveness Actions</Text>
            <Text style={dynamicStyles.bulletDesc}>
              To confirm you are a real person, you will be prompted to blink naturally and turn your head slightly.
            </Text>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={dynamicStyles.button}
        onPress={() => setStep(3)}
        accessibilityRole="button"
        accessibilityLabel="Continue to face registration"
      >
        <Text style={dynamicStyles.buttonText}>Continue to Register</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={dynamicStyles.secondaryButton}
        onPress={() => setStep(1)}
        accessibilityRole="button"
        accessibilityLabel="Go back to previous step"
      >
        <Text style={dynamicStyles.secondaryButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRegister = () => {
    const isRegisterEnabled = registrationName.trim().length > 0 && latestEmbedding != null;

    return (
      <View style={dynamicStyles.card}>
        <Text style={dynamicStyles.title}>Register Admin Face</Text>
        <Text style={dynamicStyles.subtitle}>
          Create the primary user profile by capturing your biometric facial template.
        </Text>

        {/* Input box */}
        <TextInput
          style={dynamicStyles.input}
          placeholder="Enter admin name (e.g. Adhithya)..."
          placeholderTextColor={colors.textMuted}
          value={registrationName}
          onChangeText={setRegistrationName}
          autoCorrect={false}
          accessibilityLabel="Enter admin username"
        />

        {/* Camera preview placeholder with transparent overlays.
            The actual Camera is rendered behind in App.tsx. This placeholder provides the guides. */}
        <View style={dynamicStyles.cameraPreviewPlaceholder}>
          <View style={dynamicStyles.cameraOverlay}>
            <View style={dynamicStyles.guideCircle} />
            <Text style={dynamicStyles.feedbackText}>
              {status}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            dynamicStyles.button,
            { backgroundColor: isRegisterEnabled ? colors.success : colors.primary + '80' },
          ]}
          disabled={!isRegisterEnabled}
          onPress={handleRegister}
          accessibilityRole="button"
          accessibilityLabel="Complete face registration"
        >
          <Text style={dynamicStyles.buttonText}>
            {latestEmbedding ? '✓ Face Ready — Register' : 'Align Face in Camera'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={dynamicStyles.secondaryButton}
          onPress={() => setStep(2)}
          accessibilityRole="button"
          accessibilityLabel="Go back to guidelines"
        >
          <Text style={dynamicStyles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={dynamicStyles.container}>
      {step === 0 && renderWelcome()}
      {step === 1 && renderPermissions()}
      {step === 2 && renderGuidelines()}
      {step === 3 && renderRegister()}
    </SafeAreaView>
  );
}
