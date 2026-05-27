import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { getPendingQueueItems, updateQueueItemStatus, deleteQueueItem, pruneQueue } from '../database/attendanceQueueRepository';
import { uploadAttendance, AttendanceRecord } from '../api/attendanceApi';
import { uint8ArrayToString } from './syncQueue';

const MAX_RETRY_COUNT = 5;
let isOnline = false;
let isSyncingInProgress = false;
let syncIntervalId: any = null;

// Track active network state — only act on real transitions
NetInfo.addEventListener(state => {
  const nextOnline = !!state.isConnected;
  if (nextOnline === isOnline) {
    return; // No actual change, skip
  }
  isOnline = nextOnline;
  console.log(`[SyncManager] Network status changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
  if (isOnline) {
    // Resume sync queue when internet restored (CHANGE-7)
    triggerSync();
  }
});

// Track AppState changes (CHANGE-6)
AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
  if (nextAppState === 'active') {
    console.log('[SyncManager] App transitioned to foreground. Triggering sync.');
    triggerSync();
  }
});

/**
 * Initializes the Sync Manager (starts the periodic interval timer) (CHANGE-6)
 */
export function startSyncManager(): void {
  // Query initial network state
  NetInfo.fetch().then(state => {
    isOnline = !!state.isConnected;
    triggerSync();
  });

  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }

  // Set up periodic sync check every 30 seconds (no infinite while loops) (CHANGE-6)
  syncIntervalId = setInterval(() => {
    triggerSync();
  }, 30000);

  console.log('[SyncManager] Background sync manager started');
}

/**
 * Stop sync manager background timer
 */
export function stopSyncManager(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  console.log('[SyncManager] Background sync manager stopped');
}

/**
 * Public trigger to start processing the queue
 */
export async function triggerSync(): Promise<void> {
  if (isSyncingInProgress) {
    return;
  }
  if (!isOnline) {
    // Pause sync if no internet (CHANGE-7)
    console.log('[SyncManager] Offline. Sync paused.');
    return;
  }

  isSyncingInProgress = true;
  try {
    await processQueue();
  } catch (error) {
    console.error('[SyncManager] Error during sync queue processing:', error);
  } finally {
    isSyncingInProgress = false;
  }
}

/**
 * Process pending items in the sync queue
 */
async function processQueue(): Promise<void> {
  // 1. Get pending or failed items that have not exceeded the max retry limit
  const pendingItems = await getPendingQueueItems();
  if (pendingItems.length === 0) {
    return;
  }

  console.log(`[SyncManager] Found ${pendingItems.length} pending items to synchronize`);

  for (const item of pendingItems) {
    // 2. Exponential Backoff Check (CHANGE-16)
    if (item.status === 'FAILED' && item.last_retry_at) {
      const lastRetryTime = new Date(item.last_retry_at).getTime();
      // delay = Math.pow(2, retry_count) * 1000
      const delayMs = Math.pow(2, item.retry_count) * 1000;
      const elapsed = Date.now() - lastRetryTime;

      if (elapsed < delayMs) {
        console.log(`[SyncManager] Skipping item ${item.id} (user backoff: waiting ${Math.ceil((delayMs - elapsed) / 1000)}s)`);
        continue;
      }
    }

    // 3. Mark item as SYNCING to avoid duplicate processor pickups (CHANGE-2, CHANGE-8)
    await updateQueueItemStatus(item.id, 'SYNCING', item.retry_count, item.last_retry_at);

    // 4. Parse payload
    let record: AttendanceRecord;
    try {
      const payloadStr = uint8ArrayToString(item.payload);
      record = JSON.parse(payloadStr);
    } catch (e) {
      console.error(`[SyncManager] Failed to parse payload for item ${item.id}. Pruning corrupt queue item.`, e);
      await deleteQueueItem(item.id);
      continue;
    }

    // 5. Attempt Upload
    try {
      const response = await uploadAttendance(record);

      if (response.status >= 200 && response.status < 300) {
        // Success (CHANGE-2, CHANGE-8)
        console.log(`[SyncManager] Successfully synced item ${item.id} for user ${record.userName}`);
        await updateQueueItemStatus(item.id, 'SYNCED', item.retry_count, new Date().toISOString());
      } else {
        // Handle server error (e.g. 500 or 503)
        throw new Error(response.error || 'Server returned non-200 response');
      }
    } catch (err) {
      // Failure
      const nextRetryCount = item.retry_count + 1;
      const lastRetryAt = new Date().toISOString();
      console.warn(`[SyncManager] Sync failed for item ${item.id}. Retry attempt #${nextRetryCount}`);

      if (nextRetryCount >= MAX_RETRY_COUNT) {
        // Permanently failed (CHANGE-3, CHANGE-2, CHANGE-8)
        console.error(`[SyncManager] Item ${item.id} has reached MAX_RETRY_COUNT (${MAX_RETRY_COUNT}). Marking permanently FAILED.`);
        await updateQueueItemStatus(item.id, 'FAILED', MAX_RETRY_COUNT, lastRetryAt);
      } else {
        // Increment retry and revert back to FAILED for backoff scheduling (CHANGE-2, CHANGE-8)
        await updateQueueItemStatus(item.id, 'FAILED', nextRetryCount, lastRetryAt);
      }
    }
  }

  // 6. Perform periodic queue cleanup/pruning (CHANGE-17)
  await pruneQueue();
}
