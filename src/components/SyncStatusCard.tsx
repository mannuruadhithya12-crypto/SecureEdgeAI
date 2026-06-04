import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { theme } from '../theme/theme';

interface SyncStatusCardProps {
  pendingCount: number;
  lastSynced?: string;
  onSyncNow?: () => void;
}

export function SyncStatusCard({ pendingCount, lastSynced, onSyncNow }: SyncStatusCardProps) {
  return (
    <View style={styles.syncCard}>
      <View style={styles.syncHeader}>
        <Text style={styles.syncTitle}>Cloud Synchronization</Text>
        {pendingCount > 0 ? (
          <View style={styles.syncBadge}>
            <Text style={styles.syncBadgeText}>{pendingCount} Pending</Text>
          </View>
        ) : (
          <View style={[styles.syncBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Text style={[styles.syncBadgeText, { color: theme.colors.success }]}>Synced</Text>
          </View>
        )}
      </View>
      <Text style={styles.syncText}>
        {pendingCount > 0
          ? `${pendingCount} attendance record(s) queued for synchronization.`
          : 'All attendance records synced with enterprise cloud database.'}
      </Text>
      {lastSynced ? <Text style={styles.syncTime}>Last synced: {lastSynced}</Text> : null}
      {pendingCount > 0 && onSyncNow ? (
        <TouchableOpacity style={styles.syncButton} onPress={onSyncNow}>
          <Text style={styles.syncButtonText}>Sync Now</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  syncCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  syncTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  syncBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  syncBadgeText: {
    color: theme.colors.warning,
    fontSize: 10,
    fontWeight: '700',
  },
  syncText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  syncTime: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontStyle: 'italic',
    marginBottom: theme.spacing.md,
  },
  syncButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
