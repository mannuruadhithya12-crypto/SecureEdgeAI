import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { theme } from '../theme/theme';

interface SettingsItemProps {
  label: string;
  icon: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
}

export function SettingsItem({ label, icon, onPress, rightElement, destructive }: SettingsItemProps) {
  const content = (
    <View style={styles.settingsRow}>
      <View style={styles.settingsLeft}>
        <Text style={styles.settingsIcon}>{icon}</Text>
        <Text style={[styles.settingsLabel, destructive && styles.destructiveText]}>{label}</Text>
      </View>
      {rightElement || <Text style={styles.arrowText}>❯</Text>}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.settingsButton}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    minHeight: 52,
  },
  settingsButton: {
    width: '100%',
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 16,
    marginRight: theme.spacing.md,
  },
  settingsLabel: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  destructiveText: {
    color: theme.colors.error,
  },
  arrowText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});
