import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';

interface SystemStatusProps {
  status: 'loading' | 'no-face' | 'detecting' | 'matching' | 'success' | 'failed';
  livenessConfidence?: number;
}

export default function SystemStatus({ status, livenessConfidence }: SystemStatusProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'loading':
        return { text: 'Initializing Camera...', color: '#71717a', loader: true };
      case 'no-face':
        return { text: 'Align Face in Frame', color: '#f87171', loader: false };
      case 'detecting':
        return { text: 'Face Detected', color: '#6366f1', loader: false };
      case 'matching':
        return { text: 'Comparing Biometrics...', color: '#fbbf24', loader: true };
      case 'success':
        return { text: 'Identity Verified', color: '#34d399', loader: false };
      case 'failed':
        return { text: 'Authentication Failed', color: '#ef4444', loader: false };
      default:
        return { text: 'System Offline', color: '#71717a', loader: false };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={styles.hudContainer}>
      <View style={styles.statusRow}>
        {config.loader && <ActivityIndicator size="small" color={config.color} style={styles.loader} />}
        <Text style={[styles.statusText, { color: config.color }]}>
          {config.text}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Delegate:</Text>
        <Text style={styles.metaValue}>NNAPI/GPU</Text>
      </View>

      {livenessConfidence !== undefined && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Liveness Score:</Text>
          <Text style={[styles.metaValue, { color: livenessConfidence > 0.9 ? '#34d399' : '#fbbf24' }]}>
            {(livenessConfidence * 100).toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hudContainer: {
    backgroundColor: 'rgba(10, 10, 15, 0.85)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  loader: {
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 2,
  },
  metaLabel: {
    color: '#71717a',
    fontSize: 12,
  },
  metaValue: {
    color: '#e4e4e7',
    fontSize: 12,
    fontWeight: '600',
  },
});
