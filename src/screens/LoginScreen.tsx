import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { perfMetrics } from '../utils/qaHelpers';

export default function LoginScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  useEffect(() => {
    if (perfMetrics.startupLatencyMs === 0) {
      perfMetrics.startupLatencyMs = Date.now() - perfMetrics.appLaunchTime;
      console.log(`🛡️ [QA-Perf] [Startup] Startup Latency: ${perfMetrics.startupLatencyMs}ms (Init Splash + DB Seeding)`);
    }
  }, []);

  const handleRegister = () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter your name for registration.');
      return;
    }
    if (!employeeId.trim()) {
      Alert.alert('Validation Error', 'Please enter your Employee ID.');
      return;
    }
    navigation.navigate('Camera', {
      mode: 'register',
      name: name.trim(),
      employeeId: employeeId.trim().toUpperCase(),
    });
  };

  const handleVerify = () => {
    if (!employeeId.trim()) {
      Alert.alert('Validation Error', 'Please enter your Employee ID to verify.');
      return;
    }
    navigation.navigate('Camera', {
      mode: 'verify',
      employeeId: employeeId.trim().toUpperCase(),
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome</Text>
            <Text style={styles.subtitle}>SecureEdgeAI Authentication Terminal</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. John Doe (Register only)"
              placeholderTextColor="#52525b"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Employee ID</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. SE-2026"
              placeholderTextColor="#52525b"
              value={employeeId}
              onChangeText={setEmployeeId}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={styles.buttonGroup}>
              <TouchableOpacity style={[styles.button, styles.verifyButton]} onPress={handleVerify}>
                <Text style={styles.buttonText}>Verify Identity</Text>
              </TouchableOpacity>

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity style={[styles.button, styles.registerButton]} onPress={handleRegister}>
                <Text style={styles.buttonText}>Register New Face</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  label: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#09090b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272a',
    color: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 20,
  },
  buttonGroup: {
    marginTop: 10,
    gap: 16,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButton: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  registerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#27272a',
  },
  dividerText: {
    color: '#52525b',
    paddingHorizontal: 10,
    fontSize: 12,
    textTransform: 'uppercase',
  },
});
