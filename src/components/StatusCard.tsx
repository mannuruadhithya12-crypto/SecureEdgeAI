import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme';

interface StatusCardProps {
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

export function StatusCard({ message, type }: StatusCardProps) {
  const bgColor = type === 'success' ? 'rgba(16, 185, 129, 0.1)' : type === 'warning' ? 'rgba(245, 158, 11, 0.1)' : type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(37, 99, 235, 0.1)';
  const borderColor = type === 'success' ? theme.colors.success : type === 'warning' ? theme.colors.warning : type === 'error' ? theme.colors.error : theme.colors.primary;
  const textColor = type === 'success' ? theme.colors.success : type === 'warning' ? theme.colors.warning : type === 'error' ? theme.colors.error : theme.colors.primary;
  const emoji = type === 'success' ? '🟢' : type === 'warning' ? '⚠️' : type === 'error' ? '🚨' : 'ℹ️';

  return (
    <View style={[styles.statusCard, { backgroundColor: bgColor, borderColor: borderColor }]}>
      <Text style={styles.statusCardEmoji}>{emoji}</Text>
      <Text style={[styles.statusCardText, { color: textColor }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.spacing.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
  },
  statusCardEmoji: {
    fontSize: 18,
    marginRight: theme.spacing.md,
  },
  statusCardText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    flex: 1,
  },
});
