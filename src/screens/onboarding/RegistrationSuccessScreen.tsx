import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { theme } from '../../theme/theme';

export function RegistrationSuccessScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const registrationData = route.params?.registrationData || {};

  useEffect(() => {
    console.log('[QA] REGISTRATION_COMPLETE');
  }, []);

  const handleProceed = () => {
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.successIconCircle}>
            <Text style={styles.successIcon}>✓</Text>
          </View>

          <Text style={styles.title}>Registration Complete</Text>
          <Text style={styles.welcomeText}>Welcome, {registrationData.fullName || 'User'}</Text>
          
          <View style={styles.divider} />

          <View style={styles.detailsCard}>
            <Text style={styles.detailsHeader}>Employee Account Details</Text>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Employee ID:</Text>
              <Text style={styles.detailsVal}>{registrationData.employeeId || 'N/A'}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Username:</Text>
              <Text style={styles.detailsVal}>{registrationData.username || 'N/A'}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Status:</Text>
              <Text style={[styles.detailsVal, { color: '#10B981', fontWeight: 'bold' }]}>Biometrics Active</Text>
            </View>
          </View>

          <Text style={styles.confirmationMsg}>
            Your biometric profile and local account credentials have been successfully created and secured.
          </Text>

          <PrimaryButton
            title="Proceed to Login"
            onPress={handleProceed}
            style={styles.proceedBtn}
          />
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
    paddingVertical: 40,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 2,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: {
    color: '#10B981',
    fontSize: 32,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 6,
  },
  welcomeText: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '600',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  detailsCard: {
    backgroundColor: '#0F172A',
    width: '100%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  detailsHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailsLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  detailsVal: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '500',
  },
  confirmationMsg: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  proceedBtn: {
    width: '100%',
    backgroundColor: '#2563EB',
  },
});

export default RegistrationSuccessScreen;
