import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme';

interface SecurityCardProps {
  rootStatus: boolean; // true = compromised
  debuggerStatus: boolean;
  integrityStatus: boolean;
}

export function SecurityCard({ rootStatus, debuggerStatus, integrityStatus }: SecurityCardProps) {
  return (
    <View style={styles.securityCard}>
      <View style={styles.securityHeader}>
        <Text style={styles.securityIcon}>🛡️</Text>
        <Text style={styles.securityTitle}>On-Device Device Trust Audits</Text>
      </View>
      <View style={styles.securityRow}>
        <View style={styles.securityBadge}>
          <Text style={[styles.badgeDot, { backgroundColor: rootStatus ? theme.colors.error : theme.colors.success }]} />
          <Text style={styles.badgeLabel}>OS Integrity: {rootStatus ? 'Tampered' : 'Secure'}</Text>
        </View>
        <View style={styles.securityBadge}>
          <Text style={[styles.badgeDot, { backgroundColor: debuggerStatus ? theme.colors.error : theme.colors.success }]} />
          <Text style={styles.badgeLabel}>Debug Port: {debuggerStatus ? 'Active' : 'Secure'}</Text>
        </View>
        <View style={styles.securityBadge}>
          <Text style={[styles.badgeDot, { backgroundColor: !integrityStatus ? theme.colors.error : theme.colors.success }]} />
          <Text style={styles.badgeLabel}>APK Hash: {integrityStatus ? 'Verified' : 'Invalid'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  securityCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  securityIcon: {
    fontSize: 18,
    marginRight: theme.spacing.sm,
  },
  securityTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  securityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
});
