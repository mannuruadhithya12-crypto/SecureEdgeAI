import { getDatabase } from '../database/database';

export interface SecurityAnalytics {
  authSuccessRate: number;
  authFailureRate: number;
  spoofAttempts: number;
  rootedDevices: number;
  lockouts: number;
  syncFailures: number;
  suspiciousHooks: number;
}

/**
 * Aggregates statistics from SQLite audit_logs and sync_queue tables (CHANGE-20)
 */
export async function getSecurityAnalytics(): Promise<SecurityAnalytics> {
  try {
    const db = await getDatabase();

    // 1. Fetch all audit logs (rotated to max 5000 rows automatically) (CHANGE-19)
    const result = await db.executeSql('SELECT event_type, description FROM audit_logs;');
    
    let successCount = 0;
    let failureCount = 0;
    let spoofAttempts = 0;
    let rootedDevices = 0;
    let lockouts = 0;
    let suspiciousHooks = 0;

    if (result && result.length > 0) {
      const rows = result[0].rows;
      for (let i = 0; i < rows.length; i++) {
        const item = rows.item(i);
        const eventType = item.event_type;
        const desc = item.description || '';

        if (eventType === 'AUTH_SUCCESS') {
          successCount++;
        } else if (eventType === 'AUTH_FAILURE') {
          failureCount++;
        } else if (eventType === 'SPOOF_ATTEMPT') {
          spoofAttempts++;
        } else if (eventType === 'SECURITY_WARNING') {
          if (desc.toLowerCase().includes('root')) {
            rootedDevices++;
          }
          if (desc.toLowerCase().includes('hook') || desc.toLowerCase().includes('xposed') || desc.toLowerCase().includes('frida')) {
            suspiciousHooks++;
          }
        } else if (eventType === 'LOCKOUT_TRIGGERED') {
          lockouts++;
        }
      }
    }

    // 2. Fetch sync failures count from sync_queue
    let syncFailures = 0;
    const queueResult = await db.executeSql("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'FAILED';");
    if (queueResult && queueResult.length > 0 && queueResult[0].rows.length > 0) {
      syncFailures = Number(Object.values(queueResult[0].rows.item(0))[0]) || 0;
    }

    const totalAuth = successCount + failureCount;
    const authSuccessRate = totalAuth > 0 ? (successCount / totalAuth) * 100 : 100;
    const authFailureRate = totalAuth > 0 ? (failureCount / totalAuth) * 100 : 0;

    const report: SecurityAnalytics = {
      authSuccessRate: parseFloat(authSuccessRate.toFixed(2)),
      authFailureRate: parseFloat(authFailureRate.toFixed(2)),
      spoofAttempts,
      rootedDevices,
      lockouts,
      syncFailures,
      suspiciousHooks,
    };

    console.log(`[Dashboard] Daily security report generated - Success Rate: ${report.authSuccessRate}%, Root Detections: ${report.rootedDevices}`);
    return report;
  } catch (error) {
    console.error('[Dashboard] Failed to generate security analytics:', error);
    return {
      authSuccessRate: 100,
      authFailureRate: 0,
      spoofAttempts: 0,
      rootedDevices: 0,
      lockouts: 0,
      syncFailures: 0,
      suspiciousHooks: 0,
    };
  }
}
