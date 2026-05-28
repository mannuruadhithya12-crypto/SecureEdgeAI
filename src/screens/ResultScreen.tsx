import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';

export default function ResultScreen({ route, navigation }: any) {
  const { status, mode, name, employeeId, similarity, liveness, executionTime, error } = route.params;

  const handleDone = () => {
    navigation.popToTop(); // Go back to the login screen
  };

  const isSuccess = status === 'success';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Authentication Result</Text>
      </View>

      <View style={styles.content}>
        {/* Status Card */}
        <View style={[styles.statusCard, isSuccess ? styles.successCard : styles.failureCard]}>
          <Text style={styles.statusIcon}>{isSuccess ? '✅' : '❌'}</Text>
          <Text style={styles.statusTitle}>
            {isSuccess 
              ? (mode === 'register' ? 'Registration Complete' : 'Verification Success') 
              : 'Authentication Failed'}
          </Text>
          <Text style={styles.statusDesc}>
            {isSuccess 
              ? (mode === 'register' ? 'Face template successfully saved locally.' : 'User identity matching database records.') 
              : (error || 'Biometric signature did not match any stored records.')}
          </Text>
        </View>

        {/* User Details & Metrics Panel */}
        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Diagnostic Report</Text>
          
          <View style={styles.row}>
            <Text style={styles.label}>Mode</Text>
            <Text style={styles.value}>{mode === 'register' ? 'Enrollment' : 'Verification'}</Text>
          </View>

          {name && (
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{name}</Text>
            </View>
          )}

          {employeeId && (
            <View style={styles.row}>
              <Text style={styles.label}>Employee ID</Text>
              <Text style={styles.value}>{employeeId}</Text>
            </View>
          )}

          <View style={styles.divider} />

          {isSuccess && similarity && (
            <View style={styles.row}>
              <Text style={styles.label}>Cosine Similarity</Text>
              <Text style={[styles.value, styles.metricHighlight]}>{(parseFloat(similarity) * 100).toFixed(1)}%</Text>
            </View>
          )}

          {isSuccess && liveness && (
            <View style={styles.row}>
              <Text style={styles.label}>Liveness Confidence</Text>
              <Text style={[styles.value, styles.metricHighlight]}>{(parseFloat(liveness) * 100).toFixed(1)}%</Text>
            </View>
          )}

          <View style={styles.row}>
            <Text style={styles.label}>Inference Latency</Text>
            <Text style={styles.value}>{executionTime} ms</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Security Delegate</Text>
            <Text style={styles.value}>CPU (XNNPACK/NNAPI)</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Storage Repository</Text>
            <Text style={styles.value}>SQLite (Encrypted Offline)</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleDone}>
          <Text style={styles.buttonText}>Return to Terminal</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 32,
  },
  headerTitle: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
    marginVertical: 40,
  },
  statusCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  successCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  failureCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  statusTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  statusDesc: {
    color: '#a1a1aa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  detailsCard: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    color: '#71717a',
    fontSize: 14,
  },
  value: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  metricHighlight: {
    color: '#6366f1',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#27272a',
    marginVertical: 10,
  },
  footer: {
    marginBottom: 36,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
