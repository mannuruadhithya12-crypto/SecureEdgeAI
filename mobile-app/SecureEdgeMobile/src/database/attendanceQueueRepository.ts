import { getDatabase } from './database';

export interface QueueItem {
  id: number;
  payload: Uint8Array; // BLOB
  payload_hash: string;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';
  retry_count: number;
  last_retry_at: string | null;
  created_at: string;
}

export async function insertQueueItem(payload: Uint8Array, hash: string): Promise<number> {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  
  let insertId = 0;
  await db.transaction((tx: any) => {
    tx.executeSql(
      'INSERT OR IGNORE INTO sync_queue (payload, payload_hash, status, retry_count, last_retry_at, created_at) VALUES (?, ?, ?, ?, ?, ?);',
      [payload, hash, 'PENDING', 0, null, createdAt],
      (_: any, results: any) => {
        insertId = results.insertId || 0;
      }
    );
  });
  return insertId;
}

export async function getPendingQueueItems(): Promise<QueueItem[]> {
  const db = await getDatabase();
  const result = await db.executeSql(
    "SELECT * FROM sync_queue WHERE status IN ('PENDING', 'FAILED') AND retry_count < 5 ORDER BY id ASC;"
  );
  const items: QueueItem[] = [];
  
  if (result && result.length > 0) {
    const rows = result[0].rows;
    for (let i = 0; i < rows.length; i++) {
      const item = rows.item(i);
      items.push({
        id: item.id,
        payload: item.payload,
        payload_hash: item.payload_hash,
        status: item.status,
        retry_count: item.retry_count,
        last_retry_at: item.last_retry_at,
        created_at: item.created_at,
      });
    }
  }
  return items;
}

export async function updateQueueItemStatus(
  id: number,
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED',
  retryCount: number,
  lastRetryAt: string | null = null
): Promise<void> {
  const db = await getDatabase();
  await db.transaction((tx: any) => {
    tx.executeSql(
      'UPDATE sync_queue SET status = ?, retry_count = ?, last_retry_at = ? WHERE id = ?;',
      [status, retryCount, lastRetryAt, id]
    );
  });
}

export async function deleteQueueItem(id: number): Promise<void> {
  const db = await getDatabase();
  await db.transaction((tx: any) => {
    tx.executeSql('DELETE FROM sync_queue WHERE id = ?;', [id]);
  });
}

export async function pruneQueue(): Promise<void> {
  const db = await getDatabase();
  await db.transaction((tx: any) => {
    // Delete duplicate items or permanently failed items to prevent bloat (CHANGE-17)
    tx.executeSql("DELETE FROM sync_queue WHERE status = 'SYNCED' OR retry_count >= 5;");
  });
}
