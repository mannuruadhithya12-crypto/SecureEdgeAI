import { enqueueAttendance, validateAttendanceRecord } from '../sync/syncQueue';
import { getDatabase } from '../database/database';
import { uint8ArrayToString } from '../sync/syncQueue';

export { enqueueAttendance, validateAttendanceRecord };

export interface AttendanceHistoryItem {
  id: string;
  userId: string;
  userName: string;
  timestamp: string;
  verificationScore: number;
  status: 'Present' | 'Absent';
  isOffline: boolean;
}

/**
 * Loads both offline queued and synced/logged audit records from local SQLite.
 */
export async function getAttendanceHistory(activeUserName?: string): Promise<AttendanceHistoryItem[]> {
  const db = await getDatabase();
  const list: AttendanceHistoryItem[] = [];

  // 1. Fetch offline items from sync_queue
  const queueResult = await db.executeSql('SELECT * FROM sync_queue ORDER BY id DESC;');
  if (queueResult && queueResult.length > 0) {
    const rows = queueResult[0].rows;
    for (let i = 0; i < rows.length; i++) {
      const item = rows.item(i);
      try {
        const payloadStr = uint8ArrayToString(item.payload);
        const record = JSON.parse(payloadStr);
        list.push({
          id: `q_${item.id}`,
          userId: record.userId,
          userName: record.userName,
          timestamp: record.timestamp,
          verificationScore: record.verificationScore,
          status: 'Present',
          isOffline: true,
        });
      } catch (e) {
        console.warn('[AttendanceService] Failed to parse log from sync_queue:', e);
      }
    }
  }

  // 2. Fetch logged successes/failures from audit_logs
  const auditResult = await db.executeSql(
    "SELECT * FROM audit_logs WHERE event_type IN ('AUTH_SUCCESS', 'AUTH_FAILURE') ORDER BY id DESC LIMIT 50;"
  );
  if (auditResult && auditResult.length > 0) {
    const rows = auditResult[0].rows;
    for (let i = 0; i < rows.length; i++) {
      const item = rows.item(i);
      const isSuccess = item.event_type === 'AUTH_SUCCESS';
      let name = 'Unknown';
      
      const match = item.description.match(/User (.+?) verified/);
      if (match && match[1]) {
        name = match[1];
      } else {
        const matchFail = item.description.match(/for user: (.+?)/i);
        if (matchFail && matchFail[1]) {
          name = matchFail[1];
        } else if (activeUserName) {
          name = activeUserName;
        }
      }

      list.push({
        id: `a_${item.id}`,
        userId: 'N/A',
        userName: name,
        timestamp: item.timestamp,
        verificationScore: isSuccess ? 0.90 : 0.40,
        status: isSuccess ? 'Present' : 'Absent',
        isOffline: false,
      });
    }
  }

  // Sort logs by timestamp descending
  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return list;
}
