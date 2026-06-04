import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { theme } from '../theme/theme';

interface UserCardProps {
  name: string;
  employeeId: string;
  avatarText?: string;
  onPress?: () => void;
}

export function UserCard({ name, employeeId, avatarText, onPress }: UserCardProps) {
  const content = (
    <View style={styles.userCard}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{avatarText || name.substring(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.userCardDetails}>
        <Text style={styles.welcomeText}>Hello,</Text>
        <Text style={styles.userName}>{name}</Text>
        <Text style={styles.employeeId}>Employee ID: {employeeId}</Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.spacing.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  userCardDetails: {
    flex: 1,
  },
  welcomeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  userName: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    marginVertical: 2,
  },
  employeeId: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
  },
});
