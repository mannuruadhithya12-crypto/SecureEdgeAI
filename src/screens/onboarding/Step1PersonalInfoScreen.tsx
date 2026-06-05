import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { findUserByEmployeeId } from '../../database/database';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton, SecondaryButton } from '../../components/PrimaryButton';
import { ProgressStepper } from '../../components/ProgressStepper';
import { theme } from '../../theme/theme';

export function Step1PersonalInfoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const existingData = route.params?.registrationData || {};

  const [fullName, setFullName] = useState(existingData.fullName || '');
  const [employeeId, setEmployeeId] = useState(existingData.employeeId || '');
  const [department, setDepartment] = useState(existingData.department || '');
  const [designation, setDesignation] = useState(existingData.designation || '');
  const [phone, setPhone] = useState(existingData.phone || '');
  const [email, setEmail] = useState(existingData.email || '');

  const [isValidating, setIsValidating] = useState(false);

  const validatePhone = (num: string) => {
    // Validates numbers, spaces, dashes, and optionally + sign. Minimum length 10.
    const phoneRegex = /^\+?[\d\s-]{10,15}$/;
    return phoneRegex.test(num);
  };

  const validateEmail = (mail: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(mail);
  };

  const handleContinue = async () => {
    const nameTrimmed = fullName.trim();
    const empIdTrimmed = employeeId.trim().toUpperCase();
    const deptTrimmed = department.trim();
    const desigTrimmed = designation.trim();
    const phoneTrimmed = phone.trim();
    const emailTrimmed = email.trim();

    if (!nameTrimmed || !empIdTrimmed || !deptTrimmed || !desigTrimmed || !phoneTrimmed || !emailTrimmed) {
      Alert.alert('Validation Error', 'All fields are required. Please fill in all details.');
      return;
    }

    if (!validatePhone(phoneTrimmed)) {
      Alert.alert('Validation Error', 'Please enter a valid Phone Number (minimum 10 digits).');
      return;
    }

    if (!validateEmail(emailTrimmed)) {
      Alert.alert('Validation Error', 'Please enter a valid Email Address.');
      return;
    }

    setIsValidating(true);
    try {
      // Check if Employee ID already registered
      const existingUser = await findUserByEmployeeId(empIdTrimmed);
      if (existingUser) {
        Alert.alert(
          'Duplicate Employee ID',
          `An employee profile with ID "${empIdTrimmed}" is already registered on this terminal.`
        );
        setIsValidating(false);
        return;
      }

      const registrationData = {
        ...existingData,
        fullName: nameTrimmed,
        employeeId: empIdTrimmed,
        department: deptTrimmed,
        designation: desigTrimmed,
        phone: phoneTrimmed,
        email: emailTrimmed,
      };

      setIsValidating(false);
      navigation.navigate('Step2Credentials', { registrationData });
    } catch (err) {
      setIsValidating(false);
      Alert.alert('Database Error', 'Error validating employee identity.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <AppHeader title="New Registration" onBack={() => navigation.goBack()} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.stepIndicator}>Step 1 of 4</Text>
          <ProgressStepper currentStep={0} />
          
          <Text style={styles.cardTitle}>Personal Information</Text>
          <Text style={styles.cardSubtitle}>Please fill in your primary details</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Aman Kumar"
              placeholderTextColor="#52525b"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Employee ID</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. EMP001"
              placeholderTextColor="#52525b"
              value={employeeId}
              onChangeText={setEmployeeId}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Department</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Engineering"
                placeholderTextColor="#52525b"
                value={department}
                onChangeText={setDepartment}
                autoCapitalize="words"
              />
            </View>

            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Designation</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Architect"
                placeholderTextColor="#52525b"
                value={designation}
                onChangeText={setDesignation}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#52525b"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. aman.kumar@company.com"
              placeholderTextColor="#52525b"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
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
              title={isValidating ? "Validating..." : "Continue"}
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
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
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

export default Step1PersonalInfoScreen;
