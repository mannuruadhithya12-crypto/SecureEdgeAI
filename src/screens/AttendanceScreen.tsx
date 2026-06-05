import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { getAttendanceHistory, AttendanceHistoryItem } from '../services/attendanceService';
import { AttendanceCard } from '../components/AttendanceCard';
import { theme } from '../theme/theme';

interface AttendanceScreenProps {
  activeUser: { name: string } | null;
}

export function AttendanceScreen({ activeUser }: AttendanceScreenProps) {
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceHistoryItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Present' | 'Absent'>('All');

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      console.log(`[QA] ATTENDANCE_QUERY_USER_ID ${activeUser?.name ?? 'null'}`);
      const logs = await getAttendanceHistory(activeUser?.name);
      setAttendanceLogs(logs);
      console.log(`[QA] ATTENDANCE_RECORDS_FOUND ${logs.length}`);
      if (logs.length > 0) {
        console.log('[QA] ATTENDANCE_RENDER_SUCCESS');
      }
    } catch (e) {
      console.warn('[AttendanceScreen] Failed to load attendance logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    // Reload whenever activeUser changes (catches fresh login and re-registration)
    loadLogs();
  }, [activeUser?.name]);

  const filtered = attendanceLogs.filter(log => {
    const matchesSearch = log.userName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === 'All' ||
      (filterStatus === 'Present' && log.status.toLowerCase() === 'present') ||
      (filterStatus === 'Absent' && log.status.toLowerCase() === 'absent');
    return matchesSearch && matchesStatus;
  });

  return (
    <View style={styles.container}>
      <View style={styles.searchFilterContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search employee logs..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={styles.filterChipRow}>
          {['All', 'Present', 'Absent'].map(st => {
            const isActive = filterStatus === st;
            return (
              <TouchableOpacity
                key={st}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setFilterStatus(st as any)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {st}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {isLoadingLogs ? (
        <View style={styles.centeredLoader}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loaderText}>Querying audit history database...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centeredLoader}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📅</Text>
          <Text style={styles.emptyTitle}>No Attendance Records Found</Text>
          <Text style={styles.emptyDesc}>No matches found matching the filter or search criteria.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollPadding} showsVerticalScrollIndicator={false}>
          {filtered.map(log => (
            <AttendanceCard
              key={log.id}
              timestamp={log.timestamp}
              status={log.status}
              userName={log.userName}
              isOffline={log.isOffline}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  searchFilterContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  searchInput: {
    height: 44,
    backgroundColor: '#1E293B',
    borderRadius: theme.spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    paddingHorizontal: 16,
    fontSize: theme.typography.fontSize.sm,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  centeredLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loaderText: {
    color: theme.colors.textMuted,
    marginTop: 12,
    fontSize: 12,
    fontWeight: '500',
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyDesc: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  scrollPadding: {
    padding: 20,
    paddingBottom: 40,
  },
});

export default AttendanceScreen;
