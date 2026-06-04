import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme';

interface ProfileCardProps {
  label: string;
  value: string;
  icon: string;
}

export function ProfileCard({ label, value, icon }: ProfileCardProps) {
  return (
    <View style={styles.profileRow}>
      <View style={styles.profileRowLeft}>
        <Text style={styles.profileIcon}>{icon}</Text>
        <Text style={styles.profileLabel}>{label}</Text>
      </View>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    minHeight: 52,
  },
  profileRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIcon: {
    fontSize: 16,
    marginRight: theme.spacing.md,
  },
  profileLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  profileValue: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
});
