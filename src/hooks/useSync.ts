import { useEffect } from 'react';
import { startSyncManager, stopSyncManager } from '../sync/syncManager';

export function useSync() {
  useEffect(() => {
    try {
      startSyncManager();
      console.log('[useSync] Background sync manager started successfully.');
    } catch (e) {
      console.warn('[useSync] Failed to start sync manager:', e);
    }
    
    return () => {
      try {
        stopSyncManager();
        console.log('[useSync] Background sync manager stopped successfully.');
      } catch (e) {
        console.warn('[useSync] Failed to stop sync manager:', e);
      }
    };
  }, []);
}
