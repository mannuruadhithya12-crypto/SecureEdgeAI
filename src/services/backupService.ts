import { performBackup } from '../backup/backupManager';
import { performRestore } from '../backup/restoreManager';
import RNFS from 'react-native-fs';

const BACKUP_PATH = `${RNFS.DocumentDirectoryPath}/secure_edge_backup.enc`;

export async function createDatabaseBackup(): Promise<string | null> {
  try {
    const backupPath = await performBackup();
    if (backupPath) {
      console.log(`[BackupService] Secure backup envelope written: ${backupPath}`);
      return backupPath;
    }
    return null;
  } catch (error) {
    console.error('[BackupService] Backup creation failed:', error);
    throw error;
  }
}

export async function restoreDatabaseBackup(): Promise<boolean> {
  try {
    const exists = await RNFS.exists(BACKUP_PATH);
    if (!exists) {
      console.warn('[BackupService] Restore failed: No backup envelope found.');
      return false;
    }
    await performRestore(BACKUP_PATH);
    console.log('[BackupService] Local database restored from secure backup envelope.');
    return true;
  } catch (error) {
    console.error('[BackupService] Restore failed:', error);
    throw error;
  }
}
