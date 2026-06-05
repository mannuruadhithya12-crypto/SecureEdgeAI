import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, Alert, TouchableOpacity, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDatabase } from '../../hooks/useDatabase';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton, SecondaryButton } from '../../components/PrimaryButton';
import { theme } from '../../theme/theme';
import { getSecuredData, saveSecuredData } from '../../security/secureStorage';

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const { usersList, handleSwitchUser, loadAll } = useDatabase(() => {});

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    console.log('[QA] LOGIN_SCREEN_LOADED');
    loadAll();
  }, []);

  const handlePassLogin = async () => {
    const query = usernameInput.trim().toLowerCase();
    const pass = passwordInput;

    if (!query) {
      Alert.alert('Validation Error', 'Please enter your Username or Employee ID.');
      return;
    }

    if (!pass) {
      Alert.alert('Validation Error', 'Please enter your password.');
      return;
    }

    setIsLoggingIn(true);
    console.log(`[QA] LOGIN_USERNAME ${query}`);

    try {
      // FIX ISSUE 1: Always fetch fresh users from DB at login time.
      // Do NOT rely on stale usersList state which may be empty on first render.
      const { getAllUsers } = require('../../database/userRepository');
      const freshUsers = await getAllUsers();
      console.log(`[QA] USERS_COUNT ${freshUsers.length}`);

      // Match by username (name) or employee ID (EMP00<id> format)
      const matched = freshUsers.find(
        (u: any) =>
          u.name.toLowerCase() === query ||
          (u.employee_id && u.employee_id.toLowerCase() === query) ||
          ('emp00' + u.id) === query
      );

      if (!matched) {
        setIsLoggingIn(false);
        console.log('[QA] LOGIN_USER_NOT_FOUND');
        Alert.alert(
          'Login Failed',
          'Username or Employee ID not found locally. Please register first.'
        );
        return;
      }

      console.log(`[QA] STORED_USERNAME ${matched.name}`);

      // FIX ISSUE 1: Retrieve password using the STORED username (post-decryption),
      // not the raw input. Registration saves under username.toLowerCase().
      const storedPasswordKey = `password_${matched.name.toLowerCase()}`;
      const correctPassword = await getSecuredData(storedPasswordKey);

      console.log(`[QA] PASSWORD_COMPARISON_RESULT ${pass === correctPassword ? 'MATCH' : 'MISMATCH'}`);

      if (pass === correctPassword) {
        // Activate this user's profile
        await saveSecuredData('active_user_name', matched.name);
        handleSwitchUser(matched);
        console.log('[QA] PASSWORD_LOGIN_SUCCESS');
        console.log(`[QA] ACTIVE_PROFILE_UPDATED ${matched.name}`);
        setIsLoggingIn(false);
        navigation.replace('Main');
      } else {
        setIsLoggingIn(false);
        Alert.alert('Login Failed', 'Incorrect password. Please try again.');
      }
    } catch (err) {
      setIsLoggingIn(false);
      console.error('[QA] LOGIN_ERROR', err);
      Alert.alert('System Error', 'Failed to retrieve secure credentials.');
    }
  };

  const handleFaceLoginTrigger = () => {
    if (usersList.length === 0) {
      Alert.alert(
        'No Profiles Found',
        'No enrolled biometric profiles exist on this device. Please register a face profile first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Register Now', onPress: () => navigation.navigate('Step1PersonalInfo') }
        ]
      );
      return;
    }
    
    navigation.navigate('FaceAuthentication');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <AppHeader title="SecureEdge" />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.logoBadgeContainer}>
          <View style={styles.logoBadgeOuter}>
            <Text style={styles.logoBadgeEmoji}>🛡️</Text>
            <View style={styles.logoBadgeInnerOverlay}>
              <Text style={{ fontSize: 18 }}>👤</Text>
            </View>
          </View>
          <Text style={styles.logoBadgeTitle}>SecureEdgeMobile</Text>
          <Text style={styles.logoBadgeSubtitle}>Offline Biometric Trust Terminal</Text>
          <Text style={styles.logoBadgeDetail}>Secure • Fast • Offline • AI Powered</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Welcome Back</Text>
          <Text style={styles.cardHeaderSubtitle}>Log in using password or face authentication</Text>

          <View style={styles.formInputContainer}>
            <Text style={styles.formInputLabel}>Username / Employee ID</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. John Doe or EMP001"
              placeholderTextColor="#52525b"
              value={usernameInput}
              onChangeText={setUsernameInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formInputContainer}>
            <Text style={styles.formInputLabel}>Password</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Enter password..."
              placeholderTextColor="#52525b"
              value={passwordInput}
              onChangeText={setPasswordInput}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.rememberForgotRow}>
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <Text style={styles.checkboxEmoji}>{rememberMe ? '☑️' : '⬜'}</Text>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Information', 'Offline credentials can be managed in secure settings.')}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <PrimaryButton
            title={isLoggingIn ? "Logging in..." : "Login"}
            onPress={handlePassLogin}
            disabled={isLoggingIn}
            style={{ marginTop: 8 }}
          />

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <SecondaryButton
            title="Login with Face"
            onPress={handleFaceLoginTrigger}
            icon="👤"
            style={{ borderColor: '#2563EB', borderWidth: 1 }}
            textStyle={{ color: '#F8FAFC' }}
          />
        </View>

        <View style={styles.loginRegisterLinkContainer}>
          <Text style={styles.loginRegisterText}>New Employee? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Welcome')}>
            <Text style={[styles.loginRegisterText, { color: '#2563EB', fontWeight: '700' }]}>
              Register Account Biometrics
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNoteText}>100% Offline • Secure • Private</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    width: '100%',
    marginBottom: 20,
  },
  logoBadgeContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  logoBadgeOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  logoBadgeEmoji: {
    fontSize: 40,
  },
  logoBadgeInnerOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoBadgeTitle: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
  },
  logoBadgeSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  logoBadgeDetail: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 6,
  },
  cardHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  cardHeaderSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 20,
  },
  formInputContainer: {
    marginBottom: 16,
  },
  formInputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  formInput: {
    height: 48,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: '#F8FAFC',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  rememberForgotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxEmoji: {
    fontSize: 18,
    marginRight: 6,
    color: '#2563EB',
  },
  rememberText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  forgotText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  dividerText: {
    color: '#52525b',
    paddingHorizontal: 10,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  loginRegisterLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginRegisterText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  footerNoteText: {
    color: '#52525b',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default LoginScreen;
