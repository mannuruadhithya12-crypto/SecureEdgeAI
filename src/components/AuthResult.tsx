import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

interface AuthResultProps {
  decision: 'valid' | 'uncertain' | 'reject';
  similarity: number;
  name?: string;
  employeeId?: string;
  onRetry: () => void;
  onProceed: () => void;
}

export default function AuthResult({
  decision,
  similarity,
  name,
  employeeId,
  onRetry,
  onProceed,
}: AuthResultProps) {
  const getTheme = () => {
    switch (decision) {
      case 'valid':
        return {
          title: 'ACCESS GRANTED',
          color: '#10b981',
          bg: 'rgba(16, 185, 129, 0.08)',
          desc: 'Biometric signature verified locally.',
        };
      case 'uncertain':
        return {
          title: 'MATCH UNCERTAIN',
          color: '#fbbf24',
          bg: 'rgba(251, 191, 36, 0.08)',
          desc: 'Low similarity score. Re-align and retry.',
        };
      case 'reject':
      default:
        return {
          title: 'ACCESS DENIED',
          color: '#ef4444',
          bg: 'rgba(239, 68, 68, 0.08)',
          desc: 'Face descriptor not recognized.',
        };
    }
  };

  const theme = getTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.color }]}>
      <Text style={[styles.title, { color: theme.color }]}>{theme.title}</Text>
      
      <Text style={styles.desc}>{theme.desc}</Text>

      <View style={styles.metricsContainer}>
        {name && (
          <View style={styles.row}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{name}</Text>
          </View>
        )}
        {employeeId && (
          <View style={styles.row}>
            <Text style={styles.label}>Employee ID:</Text>
            <Text style={styles.value}>{employeeId}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Similarity Score:</Text>
          <Text style={[styles.value, { color: theme.color }]}>
            {(similarity * 100).toFixed(1)}%
          </Text>
        </View>
      </View>

      <View style={styles.btnRow}>
        {decision !== 'valid' ? (
          <TouchableOpacity style={[styles.btn, styles.btnRetry]} onPress={onRetry}>
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.btnProceed]} onPress={onProceed}>
            <Text style={styles.btnText}>Return to Terminal</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    width: '90%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    marginVertical: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  desc: {
    color: '#a1a1aa',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  metricsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#71717a',
    fontSize: 13,
  },
  value: {
    color: '#e4e4e7',
    fontSize: 13,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 30,
    minWidth: 150,
    alignItems: 'center',
  },
  btnRetry: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  btnProceed: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
