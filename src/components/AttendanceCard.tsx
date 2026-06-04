import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme';

interface AttendanceCardProps {
  timestamp: string;
  status: 'Present' | 'Absent' | string;
  userName?: string;
  isOffline?: boolean;
}

export function AttendanceCard({ timestamp, status, userName, isOffline }: AttendanceCardProps) {
  const isPresent = status.toLowerCase() === 'present';
  
  // Format Date and Time
  let timeStr = timestamp;
  let dateStr = '';
  try {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      dateStr = d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch (e) {}

  return (
    <View style={styles.attendanceCard}>
      <View style={styles.attendanceLeft}>
        <View style={[styles.statusIndicatorCircle, { backgroundColor: isPresent ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
          <Text style={{ fontSize: 16 }}>{isPresent ? '🟢' : '🔴'}</Text>
        </View>
        <View style={styles.attendanceInfo}>
          <Text style={styles.attendanceTime}>{timeStr}</Text>
          <Text style={styles.attendanceDate}>{dateStr}</Text>
          {userName ? <Text style={styles.attendanceUser}>Auth for: {userName}</Text> : null}
        </View>
      </View>
      
      <View style={styles.attendanceRight}>
        <View style={[styles.statusChip, { backgroundColor: isPresent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
          <Text style={[styles.statusChipText, { color: isPresent ? theme.colors.success : theme.colors.error }]}>
            {status}
          </Text>
        </View>
        {isOffline ? <Text style={styles.offlineBadge}>📂 Local</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  attendanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  attendanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicatorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  attendanceInfo: {
    flex: 1,
  },
  attendanceTime: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  attendanceDate: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  attendanceUser: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  attendanceRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusChipText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '700',
  },
  offlineBadge: {
    fontSize: 9,
    color: theme.colors.warning,
    fontWeight: '700',
    marginTop: 2,
  },
});
