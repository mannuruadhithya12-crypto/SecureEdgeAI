import { getDatabase } from '../database/database';

export interface AuditRecord {
  id: number;
  event_type: string;
  description: string;
  timestamp: string;
}

const MAX_AUDIT_LOGS = 5000;

export async function logSecurityEvent(eventType: string, description: string): Promise<void> {
  try {
    const db = await getDatabase();
    const timestamp = new Date().toISOString();
    
    await db.transaction((tx: any) => {
      // 1. Insert new audit log (CHANGE-8)
      tx.executeSql(
        'INSERT INTO audit_logs (event_type, description, timestamp) VALUES (?, ?, ?);',
        [eventType, description, timestamp]
      );
      
      // 2. Enforce log rotation limit (CHANGE-13)
      tx.executeSql(`
        DELETE FROM audit_logs WHERE id NOT IN (
          SELECT id FROM audit_logs ORDER BY timestamp DESC, id DESC LIMIT ?
        );
      `, [MAX_AUDIT_LOGS]);
    });
    
    // Release-safe logging (CHANGE-20)
    console.log(`[AuditLogger] Event logged: ${eventType}`);
  } catch (error) {
    console.error('[AuditLogger] Failed to write security event:', error);
  }
}

export async function getAuditLogs(): Promise<AuditRecord[]> {
  try {
    const db = await getDatabase();
    const result = await db.executeSql('SELECT * FROM audit_logs ORDER BY timestamp DESC, id DESC;');
    const logs: AuditRecord[] = [];
    
    if (result && result.length > 0) {
      const rows = result[0].rows;
      for (let i = 0; i < rows.length; i++) {
        logs.push(rows.item(i) as AuditRecord);
      }
    }
    return logs;
  } catch (error) {
    console.error('[AuditLogger] Failed to query audit logs:', error);
    return [];
  }
}
