import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, StatusBar, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { initDB } from '../database/database';
import { getSecuredData } from '../security/secureStorage';
import { prepareTfliteModels } from '../ai/modelSources';
import { theme } from '../theme/theme';

export function SplashScreen() {
  const navigation = useNavigation<any>();
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    const setupAndNavigate = async () => {
      try {
        await initDB();
        await prepareTfliteModels();
      } catch (err) {
        console.warn('[Splash] DB setup warning:', err);
      }
      
      setTimeout(async () => {
        try {
          const onboard = await getSecuredData('setting_onboardingCompleted');
          if (onboard === 'true') {
            navigation.replace('Main');
          } else {
            navigation.replace('Auth');
          }
        } catch {
          navigation.replace('Auth');
        }
      }, 2000);
    };
    setupAndNavigate();
  }, [navigation, scaleAnim, opacityAnim]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      <Animated.View 
        style={[
          styles.logoContainer, 
          { 
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>🛡️</Text>
          <View style={styles.faceOverlay}>
            <Text style={styles.faceText}>👤</Text>
          </View>
        </View>
        <Text style={styles.title}>SecureEdge</Text>
        <Text style={styles.titleSuffix}>MOBILE</Text>
        <Text style={styles.subtitle}>AI Powered Face Authentication</Text>
      </Animated.View>

      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Initializing local security audits...</Text>
        <Text style={styles.footerText}>Secure. Offline. Reliable.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl * 2,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.25)',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
  },
  logoText: {
    fontSize: 54,
  },
  faceOverlay: {
    position: 'absolute',
    opacity: 0.75,
  },
  faceText: {
    fontSize: 24,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  title: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  titleSuffix: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '800',
    letterSpacing: 4,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: theme.spacing.md,
  },
  loaderContainer: {
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.sm,
    fontWeight: '500',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.22)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: theme.spacing.xs,
  },
});

export default SplashScreen;
