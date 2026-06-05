import { enqueueAttendance, validateAttendanceRecord } from '../sync/syncQueue';
import { getDatabase } from '../database/database';

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
 * Convert a hex string (returned by SQLite hex() function) back to a UTF-8 string.
 */
function hexToUtf8(hex: string): string {
  if (!hex || hex.length % 2 !== 0) return '';
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    result += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return result;
}

/**
 * Loads offline queued and synced/logged audit records from local SQLite.
 * FIX ISSUE 4:
 *  - Uses hex(payload) to safely read BLOB data from sync_queue.
 *  - Filters results to only the activeUser when provided.
 *  - Adds full QA logging.
 */
export async function getAttendanceHistory(activeUserName?: string): Promise<AttendanceHistoryItem[]> {
  const db = await getDatabase();
  const list: AttendanceHistoryItem[] = [];

  console.log(`[QA] ATTENDANCE_QUERY_USER_ID ${activeUserName ?? 'ALL'}`);

  // ── 1. Offline sync_queue records ────────────────────────────────────────────
  // Use hex(payload) so the BLOB is always returned as a readable hex string
  // regardless of how react-native-sqlite-storage returns binary data.
  try {
    const queueResult = await db.executeSql(
      'SELECT id, hex(payload) as payload_hex, status, created_at FROM sync_queue ORDER BY id DESC;'
    );

    if (queueResult && queueResult.length > 0) {
      const rows = queueResult[0].rows;
      for (let i = 0; i < rows.length; i++) {
        const item = rows.item(i);
        try {
          const payloadStr = hexToUtf8(item.payload_hex);
          const record = JSON.parse(payloadStr);

          // Filter by activeUser when specified
          if (activeUserName && record.userName !== activeUserName) continue;

          list.push({
            id: `q_${item.id}`,
            userId: record.userId ?? 'N/A',
            userName: record.userName ?? activeUserName ?? 'Unknown',
            timestamp: record.timestamp ?? item.created_at,
            verificationScore: record.verificationScore ?? 0.9,
            status: 'Present',
            isOffline: true,
          });
        } catch (e) {
          console.warn('[AttendanceService] Failed to parse sync_queue payload:', e);
        }
      }
    }
  } catch (e) {
    console.warn('[AttendanceService] sync_queue query failed:', e);
  }

  // ── 2. Audit log records (AUTH_SUCCESS / AUTH_FAILURE) ───────────────────────
  try {
    const auditResult = await db.executeSql(
      "SELECT id, event_type, description, timestamp FROM audit_logs " +
      "WHERE event_type IN ('AUTH_SUCCESS', 'AUTH_FAILURE') ORDER BY id DESC LIMIT 100;"
    );

    if (auditResult && auditResult.length > 0) {
      const rows = auditResult[0].rows;
      for (let i = 0; i < rows.length; i++) {
        const item = rows.item(i);
        const isSuccess = item.event_type === 'AUTH_SUCCESS';
        let name: string = activeUserName ?? 'Unknown';

        // FIX: Corrected regex patterns — no trailing slash in match()
        const matchSuccess = item.description
          ? item.description.match(/User (.+?) verified/)
          : null;
        const matchFail = item.description
          ? item.description.match(/for user: ([^\s(]+)/)
          : null;

        if (matchSuccess && matchSuccess[1]) {
          name = matchSuccess[1].trim();
        } else if (matchFail && matchFail[1]) {
          name = matchFail[1].trim();
        }

        // Filter by activeUser when specified
        if (activeUserName && name !== activeUserName) continue;

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
  } catch (e) {
    console.warn('[AttendanceService] audit_logs query failed:', e);
  }

  // Sort descending by timestamp
  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  console.log(`[QA] ATTENDANCE_RECORDS_FOUND ${list.length}`);
  if (list.length > 0) {
    console.log('[QA] ATTENDANCE_RENDER_SUCCESS');
  }

  return list;
}
