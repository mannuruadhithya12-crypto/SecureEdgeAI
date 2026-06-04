import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme';

interface SpoofIndicatorProps {
  passed: boolean;
  score: number;
}

export function SpoofIndicator({ passed, score }: SpoofIndicatorProps) {
  return (
    <View style={[styles.spoofCard, { borderColor: passed ? theme.colors.success : theme.colors.error }]}>
      <Text style={styles.spoofTitle}>Anti-Spoofing Check</Text>
      <View style={styles.spoofRow}>
        <Text style={[styles.spoofStatus, { color: passed ? theme.colors.success : theme.colors.error }]}>
          {passed ? '✓ PASSED' : '✗ DETECTED'}
        </Text>
        <Text style={styles.spoofScore}>Confidence: {(score * 100).toFixed(0)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  spoofCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.spacing.borderRadius.md,
    borderWidth: 1.5,
    marginBottom: theme.spacing.xl,
  },
  spoofTitle: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: theme.typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  spoofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spoofStatus: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  spoofScore: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
