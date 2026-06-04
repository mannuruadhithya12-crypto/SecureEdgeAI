import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme';

interface LivenessIndicatorProps {
  blinkPassed: boolean;
  headTurnPassed: boolean;
}

export function LivenessIndicator({ blinkPassed, headTurnPassed }: LivenessIndicatorProps) {
  return (
    <View style={styles.livenessContainer}>
      <View style={styles.livenessHeader}>
        <Text style={styles.livenessTitle}>Liveness Audits</Text>
        <View style={[styles.statusIndicatorCircle, { backgroundColor: (blinkPassed && headTurnPassed) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' }]}>
          <Text style={{ fontSize: 10 }}>{(blinkPassed && headTurnPassed) ? '🟢' : '🟡'}</Text>
        </View>
      </View>
      <View style={styles.livenessRow}>
        <View style={styles.livenessItem}>
          <Text style={styles.livenessIcon}>{blinkPassed ? '✅' : '⏳'}</Text>
          <Text style={[styles.livenessLabel, blinkPassed && styles.livenessActive]}>Eye Blink</Text>
        </View>
        <View style={styles.livenessItem}>
          <Text style={styles.livenessIcon}>{headTurnPassed ? '✅' : '⏳'}</Text>
          <Text style={[styles.livenessLabel, headTurnPassed && styles.livenessActive]}>Head Orientation</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  livenessContainer: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  livenessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  livenessTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  statusIndicatorCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  livenessRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  livenessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    flex: 1,
    justifyContent: 'center',
  },
  livenessIcon: {
    fontSize: 14,
    marginRight: theme.spacing.sm,
  },
  livenessLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  livenessActive: {
    color: theme.colors.success,
  },
});
