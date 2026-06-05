import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, StatusBar, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDatabase } from '../../hooks/useDatabase';
import { PrimaryButton } from '../../components/PrimaryButton';
import { theme } from '../../theme/theme';

export function WelcomeScreen() {
  const navigation = useNavigation<any>();
  const { usersList, loadAll } = useDatabase(() => {});
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadAll();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (usersList.length > 0) {
      navigation.replace('Login');
    }
  }, [usersList]);

  const handleStartOnboarding = () => {
    navigation.navigate('Step1PersonalInfo');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🛡️</Text>
            <View style={styles.logoOverlay}>
              <Text style={{ fontSize: 16 }}>👤</Text>
            </View>
          </View>
          
          <Text style={styles.title}>Welcome to SecureEdge</Text>
          <Text style={styles.subtitle}>
            Enterprise Offline Biometric Enrollment Terminal
          </Text>

          <View style={styles.divider} />

          <View style={styles.bulletRow}>
            <Text style={styles.bulletIcon}>🔒</Text>
            <View style={styles.bulletTextContainer}>
              <Text style={styles.bulletTitle}>Local & Encrypted</Text>
              <Text style={styles.bulletDesc}>
                All biometric profiles and credentials are encrypted and stored locally in the hardware-secure SQLite engine.
              </Text>
            </View>
          </View>

          <View style={styles.bulletRow}>
            <Text style={styles.bulletIcon}>👁️</Text>
            <View style={styles.bulletTextContainer}>
              <Text style={styles.bulletTitle}>Biometric Liveness Verification</Text>
              <Text style={styles.bulletDesc}>
                Uses BlazeFace and MobileFaceNet pipelines with anti-spoof checks, blink checks, and head movement audits.
              </Text>
            </View>
          </View>

          <View style={styles.bulletRow}>
            <Text style={styles.bulletIcon}>⚡</Text>
            <View style={styles.bulletTextContainer}>
              <Text style={styles.bulletTitle}>4-Step Easy Setup</Text>
              <Text style={styles.bulletDesc}>
                Enter personal details, credentials, review your summary, and complete your Face Enrollment scan.
              </Text>
            </View>
          </View>

          <PrimaryButton
            title="Start Onboarding"
            onPress={handleStartOnboarding}
            style={styles.actionBtn}
          />
        </Animated.View>
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
    paddingVertical: 30,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  logoEmoji: {
    fontSize: 40,
  },
  logoOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    fontWeight: '600',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    width: '100%',
  },
  bulletIcon: {
    fontSize: 20,
    marginRight: 16,
    marginTop: 2,
  },
  bulletTextContainer: {
    flex: 1,
  },
  bulletTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  bulletDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
  actionBtn: {
    width: '100%',
    marginTop: 10,
    backgroundColor: '#2563EB',
  },
});

export default WelcomeScreen;
