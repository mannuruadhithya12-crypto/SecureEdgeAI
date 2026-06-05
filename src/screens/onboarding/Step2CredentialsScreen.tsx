import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAllUsers } from '../../database/userRepository';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton, SecondaryButton } from '../../components/PrimaryButton';
import { ProgressStepper } from '../../components/ProgressStepper';
import { theme } from '../../theme/theme';

export function Step2CredentialsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const registrationData = route.params?.registrationData || {};

  const [username, setUsername] = useState(registrationData.username || '');
  const [password, setPassword] = useState(registrationData.password || '');
  const [confirmPassword, setConfirmPassword] = useState(registrationData.confirmPassword || '');

  const [usersList, setUsersList] = useState<any[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const list = await getAllUsers();
        setUsersList(list);
      } catch (err) {
        console.warn('Error loading users:', err);
      }
    };
    loadUsers();
  }, []);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'None', color: '#52525b', width: '0%' };
    
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) {
      return { score: 1, label: 'Weak', color: '#EF4444', width: '33%' };
    } else if (score <= 4) {
      return { score: 2, label: 'Medium', color: '#F59E0B', width: '66%' };
    } else {
      return { score: 3, label: 'Strong', color: '#10B981', width: '100%' };
    }
  };

  const strength = getPasswordStrength(password);

  const handleContinue = async () => {
    const usernameTrimmed = username.trim().toLowerCase();
    const pass = password;
    const confirm = confirmPassword;

    if (!usernameTrimmed) {
      Alert.alert('Validation Error', 'Username is required.');
      return;
    }

    if (usernameTrimmed.length < 3) {
      Alert.alert('Validation Error', 'Username must be at least 3 characters.');
      return;
    }

    if (!pass) {
      Alert.alert('Validation Error', 'Password is required.');
      return;
    }

    if (pass.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    if (pass !== confirm) {
      Alert.alert('Validation Error', 'Passwords do not match. Please verify.');
      return;
    }

    setIsValidating(true);

    // Verify username is unique
    const duplicate = usersList.find(u => u.name.toLowerCase() === usernameTrimmed);
    if (duplicate) {
      Alert.alert(
        'Username Taken',
        `The username "${username}" is already in use. Please select a different username.`
      );
      setIsValidating(false);
      return;
    }

    const updatedData = {
      ...registrationData,
      username: usernameTrimmed,
      password: pass,
    };

    setIsValidating(false);
    navigation.navigate('Step3Review', { registrationData: updatedData });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <AppHeader title="New Registration" onBack={() => navigation.goBack()} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.stepIndicator}>Step 2 of 4</Text>
          <ProgressStepper currentStep={1} />
          
          <Text style={styles.cardTitle}>Account Credentials</Text>
          <Text style={styles.cardSubtitle}>Configure your secure authentication profile</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter unique username..."
              placeholderTextColor="#52525b"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Minimum 6 characters..."
              placeholderTextColor="#52525b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBarBackground}>
                  <View style={[styles.strengthBar, { width: strength.width as any, backgroundColor: strength.color }]} />
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>
                  Strength: {strength.label}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter password..."
              placeholderTextColor="#52525b"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.btnRow}>
            <SecondaryButton
              title="Back"
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              textStyle={{ color: '#F8FAFC' }}
            />
            <PrimaryButton
              title={isValidating ? "Checking..." : "Continue"}
              onPress={handleContinue}
              disabled={isValidating}
              style={styles.continueBtn}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginTop: 10,
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
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  input: {
    height: 48,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: '#F8FAFC',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  strengthContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  strengthBarBackground: {
    flex: 1,
    height: 4,
    backgroundColor: '#0F172A',
    borderRadius: 2,
    marginRight: 12,
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    width: 90,
    textAlign: 'right',
  },
  btnRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  backBtn: {
    flex: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
  },
  continueBtn: {
    flex: 1.5,
    backgroundColor: '#2563EB',
  },
});

export default Step2CredentialsScreen;
