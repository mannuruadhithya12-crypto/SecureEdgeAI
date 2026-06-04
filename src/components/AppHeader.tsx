import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { theme } from '../theme/theme';

interface AppHeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function AppHeader({ title, onBack, rightAction }: AppHeaderProps) {
  return (
    <View style={styles.headerContainer}>
      {onBack ? (
        <TouchableOpacity style={styles.backButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.headerPlaceholder} />
      )}
      
      <Text style={styles.headerTitle}>{title}</Text>
      
      <View style={styles.rightActionContainer}>
        {rightAction || <View style={styles.headerPlaceholder} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    height: 64,
  },
  backButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerPlaceholder: {
    width: 44,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
  },
  rightActionContainer: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
});
