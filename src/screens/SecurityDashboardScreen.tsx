import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppHeader } from '../components/AppHeader';
import { SecurityCard } from '../components/SecurityCard';
import { StatusCard } from '../components/StatusCard';
import { theme } from '../theme/theme';
import { runSecurityTelemetrySweep, getSecurityAnalytics, type SecurityAnalytics, type SecurityTelemetryReport } from '../services/securityService';
import { getAuditLogs, type AuditRecord } from '../security/auditLogger';

export function SecurityDashboardScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [telemetry, setTelemetry] = useState<SecurityTelemetryReport | null>(null);
  const [analytics, setAnalytics] = useState<SecurityAnalytics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const tel = await runSecurityTelemetrySweep();
      const ana = await getSecurityAnalytics();
      const logs = await getAuditLogs();
      
      setTelemetry(tel);
      setAnalytics(ana);
      // Limit to last 20 records for dashboard presentation
      setAuditLogs(logs.slice(0, 20));
    } catch (e) {
      console.warn('[SecurityDashboard] Failed to query security audits:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      <View style={styles.sectionHeaderLine} />
    </View>
  );

  return (
    <View style={styles.container}>
      <AppHeader title="OS Hardening" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.centeredLoader}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loaderText}>Auditing sandbox protections...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {renderSectionHeader('Sandbox Hardening Status')}
          
          <SecurityCard
            rootStatus={telemetry?.isRooted || false}
            debuggerStatus={telemetry?.isDebuggerAttached || false}
            integrityStatus={telemetry?.isApkVerified || false}
          />

          {renderSectionHeader('Audit Metric Analytics')}

          {analytics && (
            <View style={styles.analyticsCard}>
              <View style={styles.analyticsRow}>
                <View style={styles.analyticItem}>
                  <Text style={styles.analyticLabel}>Verification Success Rate</Text>
                  <Text style={[styles.analyticValue, { color: theme.colors.success }]}>
                    {analytics.authSuccessRate}%
                  </Text>
                </View>
                <View style={styles.analyticItem}>
                  <Text style={styles.analyticLabel}>Anti-Spoof Triggers</Text>
                  <Text style={[styles.analyticValue, { color: analytics.spoofAttempts > 0 ? theme.colors.error : theme.colors.text }]}>
                    {analytics.spoofAttempts}
                  </Text>
                </View>
              </View>

              <View style={styles.analyticsRow}>
                <View style={styles.analyticItem}>
                  <Text style={styles.analyticLabel}>Security Lockouts</Text>
                  <Text style={[styles.analyticValue, { color: analytics.lockouts > 0 ? theme.colors.error : theme.colors.text }]}>
                    {analytics.lockouts}
                  </Text>
                </View>
                <View style={styles.analyticItem}>
                  <Text style={styles.analyticLabel}>Suspicious Hooks</Text>
                  <Text style={[styles.analyticValue, { color: analytics.suspiciousHooks > 0 ? theme.colors.error : theme.colors.text }]}>
                    {analytics.suspiciousHooks}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {renderSectionHeader('Recent Security Audit Logs')}

          {auditLogs.length === 0 ? (
            <StatusCard type="success" message="No warnings or security violations recorded in local audit trail database." />
          ) : (
            <View style={styles.logList}>
              {auditLogs.map(log => {
                const isWarning = log.event_type === 'SECURITY_WARNING' || log.event_type === 'AUTH_FAILURE';
                return (
                  <View key={log.id} style={styles.logItem}>
                    <View style={styles.logHeader}>
                      <View style={[styles.logIndicator, { backgroundColor: isWarning ? theme.colors.error : theme.colors.success }]} />
                      <Text style={styles.logType}>{log.event_type}</Text>
                      <Text style={styles.logTime}>{new Date(log.timestamp).toLocaleTimeString()}</Text>
                    </View>
                    <Text style={styles.logDesc}>{log.description}</Text>
                  </View>
                );
              })}
            </View>
          )}
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
  centeredLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loaderText: {
    color: theme.colors.textMuted,
    marginTop: 12,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  sectionHeaderTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  analyticsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 16,
    marginBottom: 8,
  },
  analyticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  analyticItem: {
    flex: 1,
  },
  analyticLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  analyticValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  logList: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  logItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  logType: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
  },
  logTime: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
  logDesc: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingLeft: 14,
  },
});

export default SecurityDashboardScreen;
