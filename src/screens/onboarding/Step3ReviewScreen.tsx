import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';
import { PrimaryButton, SecondaryButton } from '../../components/PrimaryButton';
import { ProgressStepper } from '../../components/ProgressStepper';
import { theme } from '../../theme/theme';

export function Step3ReviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const registrationData = route.params?.registrationData || {};

  const handleEdit = () => {
    // Navigate back to Step 1 with existing data
    navigation.navigate('Step1PersonalInfo', { registrationData });
  };

  const handleContinue = () => {
    navigation.navigate('FaceRegistration', { registrationData });
  };

  const SummaryItem = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value || 'N/A'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <AppHeader title="New Registration" onBack={handleEdit} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.stepIndicator}>Step 3 of 4</Text>
          <ProgressStepper currentStep={2} />
          
          <Text style={styles.cardTitle}>Review & Confirm</Text>
          <Text style={styles.cardSubtitle}>Ensure all details match your company credentials</Text>

          <View style={styles.summaryCard}>
            <Text style={styles.sectionHeader}>Personal Details</Text>
            <SummaryItem label="Full Name" value={registrationData.fullName} />
            <SummaryItem label="Employee ID" value={registrationData.employeeId} />
            <SummaryItem label="Department" value={registrationData.department} />
            <SummaryItem label="Designation" value={registrationData.designation} />
            <SummaryItem label="Phone Number" value={registrationData.phone} />
            <SummaryItem label="Email Address" value={registrationData.email} />

            <View style={styles.itemDivider} />

            <Text style={styles.sectionHeader}>Account Details</Text>
            <SummaryItem label="Username" value={registrationData.username} />
            <SummaryItem label="Password" value="••••••••" />
          </View>

          <View style={styles.btnRow}>
            <SecondaryButton
              title="Edit Information"
              onPress={handleEdit}
              style={styles.editBtn}
              textStyle={{ color: '#F8FAFC' }}
            />
            <PrimaryButton
              title="Proceed to Face Scan"
              onPress={handleContinue}
              style={styles.continueBtn}
            />
          </View>
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
  summaryCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    padding: 18,
    marginBottom: 24,
  },
  sectionHeader: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  summaryItem: {
    marginBottom: 12,
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
  },
  itemDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 14,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editBtn: {
    flex: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
  },
  continueBtn: {
    flex: 1.5,
    backgroundColor: '#2563EB',
  },
});

export default Step3ReviewScreen;
