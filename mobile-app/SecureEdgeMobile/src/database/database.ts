import SQLite from 'react-native-sqlcipher-storage';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { getDbPassphraseKey } from '../security/secureStorage';

SQLite.enablePromise(true);

const DATABASE_NAME = 'SecureEdge.db';
const CURRENT_SCHEMA_VERSION = 2;

// Standard React Native database location paths
const getDatabasePath = (): string => {
  if (Platform.OS === 'android') {
    return `${RNFS.DocumentDirectoryPath}/../databases/${DATABASE_NAME}`;
  } else {
    // iOS SQLite path
    return `${RNFS.LibraryDirectoryPath}/LocalDatabase/${DATABASE_NAME}`;
  }
};

let dbInstance: SQLite.SQLiteDatabase | null = null;
let isDbEncrypted = false;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDatabasePath();
  const dbKey = await getDbPassphraseKey();

  // 1. Ensure databases directory exists on Android
  if (Platform.OS === 'android') {
    const dbDir = `${RNFS.DocumentDirectoryPath}/../databases`;
    const dirExists = await RNFS.exists(dbDir);
    if (!dirExists) {
      await RNFS.mkdir(dbDir);
    }
  }

  const dbExists = await RNFS.exists(dbPath);

  if (dbExists) {
    // 2. Perform Migration check or Integrity check (CHANGE-4)
    try {
      // Try opening as SQLCipher first
      dbInstance = await openCipherDatabase(dbKey);
      const integrityPassed = await runIntegrityCheck(dbInstance);

      if (!integrityPassed) {
        console.warn('[Database] SQLCipher integrity check failed! Recovering...');
        await recoverCorruptDatabase(dbPath, dbKey);
      } else {
        isDbEncrypted = true;
        console.log('[Database] SQLCipher Database opened and verified successfully');
      }
    } catch (e) {
      // Opening with SQLCipher failed. This means the DB file is unencrypted, or key is wrong.
      console.log('[Database] Failed to open as encrypted. Checking for unencrypted database migration...');
      try {
        // Try opening as unencrypted
        dbInstance = await openUnencryptedDatabase();
        console.log('[Database] Unencrypted database opened. Starting SQLCipher migration...');
        
        // Close it so we can run migration safely
        await dbInstance.close();
        dbInstance = null;

        await runSqlCipherMigration(dbPath, dbKey);
      } catch (migrationErr) {
        console.error('[Database] SQLCipher migration failed, falling back to unencrypted database:', migrationErr);
        // Fallback: Open unencrypted to preserve user data (CHANGE-16)
        dbInstance = await openUnencryptedDatabase();
        isDbEncrypted = false;
      }
    }
  } else {
    // New database: Create directly with SQLCipher encryption
    console.log('[Database] Creating new SQLCipher encrypted database...');
    dbInstance = await openCipherDatabase(dbKey);
    isDbEncrypted = true;
  }

  // 3. Configure WAL support & run migrations (CHANGE-8)
  try {
    await dbInstance!.executeSql('PRAGMA journal_mode = WAL;');
  } catch (err) {
    console.warn('[Database] WAL journaling setup failed', err);
  }

  await runMigrations(dbInstance!);

  // 4. Run database benchmarking after successful open (CHANGE-13)
  if (isDbEncrypted) {
    await benchmarkDatabase(dbInstance!);
  }

  return dbInstance!;
}

async function openCipherDatabase(key: string): Promise<SQLite.SQLiteDatabase> {
  return await SQLite.openDatabase({
    name: DATABASE_NAME,
    location: 'default',
    key: key
  });
}

async function openUnencryptedDatabase(): Promise<SQLite.SQLiteDatabase> {
  return await SQLite.openDatabase({
    name: DATABASE_NAME,
    location: 'default'
  });
}

/**
 * Executes a SQLite integrity check (CHANGE-4)
 */
async function runIntegrityCheck(db: SQLite.SQLiteDatabase): Promise<boolean> {
  try {
    const result = await db.executeSql('PRAGMA integrity_check;');
    if (result && result.length > 0 && result[0].rows && result[0].rows.length > 0) {
      const row = result[0].rows.item(0);
      const status = Object.values(row)[0];
      return status === 'ok';
    }
  } catch (e) {
    console.error('[Database] Integrity check query failed:', e);
  }
  return false;
}

/**
 * Recovers a corrupt database from the latest secure backup envelope (CHANGE-4)
 */
async function recoverCorruptDatabase(dbPath: string, dbKey: string): Promise<void> {
  try {
    const backupJsonPath = `${RNFS.DocumentDirectoryPath}/secure_edge_backup.enc`;
    const backupExists = await RNFS.exists(backupJsonPath);
    
    if (backupExists) {
      console.log('[Database] Found secure backup file. Restoring database...');
      // Delete corrupt DB file
      await RNFS.unlink(dbPath);
      
      // Open new clean DB
      dbInstance = await openCipherDatabase(dbKey);
      
      // Perform restore from file
      const { performRestore } = require('../backup/restoreManager');
      await performRestore(backupJsonPath);
      console.log('[Database] Database successfully recovered from backup.');
    } else {
      console.error('[Database] Recovery failed: No backup file found.');
      throw new Error('Database integrity failure and no backup available.');
    }
  } catch (err) {
    console.error('[Database] Critical recovery failure:', err);
    throw err;
  }
}

/**
 * Safe SQLCipher migration framework with fallback recovery (CHANGE-15, CHANGE-16)
 */
async function runSqlCipherMigration(dbPath: string, dbKey: string): Promise<void> {
  const backupDbPath = dbPath + '.bak';
  const tempEncryptedDbName = 'SecureEdge_temp_enc.db';
  
  let tempEncryptedDbPath = '';
  if (Platform.OS === 'android') {
    tempEncryptedDbPath = `${RNFS.DocumentDirectoryPath}/../databases/${tempEncryptedDbName}`;
  } else {
    tempEncryptedDbPath = `${RNFS.LibraryDirectoryPath}/LocalDatabase/${tempEncryptedDbName}`;
  }

  try {
    console.log('[Database] Step-1: Backing up unencrypted SQLite database file...');
    // Create physical file backup (CHANGE-15)
    if (await RNFS.exists(backupDbPath)) {
      await RNFS.unlink(backupDbPath);
    }
    await RNFS.copyFile(dbPath, backupDbPath);

    console.log('[Database] Step-2: Running encryption migration to temp file...');
    // Delete target temp file if it exists
    if (await RNFS.exists(tempEncryptedDbPath)) {
      await RNFS.unlink(tempEncryptedDbPath);
    }

    // Open unencrypted database again
    const unencryptedDb = await openUnencryptedDatabase();
    
    // Attach temp file as encrypted database
    await unencryptedDb.executeSql(
      `ATTACH DATABASE ? AS encrypted KEY ?;`,
      [tempEncryptedDbPath, dbKey]
    );

    // Export database content into the attached SQLCipher file (sqlcipher_export)
    await unencryptedDb.executeSql("SELECT sqlcipher_export('encrypted');");
    await unencryptedDb.executeSql("DETACH DATABASE encrypted;");
    await unencryptedDb.close();

    console.log('[Database] Step-3: Verifying integrity of newly encrypted database...');
    const verifyDb = await SQLite.openDatabase({
      name: tempEncryptedDbName,
      location: 'default',
      key: dbKey
    });

    const isIntegrityOk = await runIntegrityCheck(verifyDb);
    await verifyDb.close();

    if (!isIntegrityOk) {
      throw new Error('Encrypted database integrity verification failed.');
    }

    console.log('[Database] Step-4: Replacing old SQLite file with SQLCipher database...');
    await RNFS.unlink(dbPath);
    await RNFS.copyFile(tempEncryptedDbPath, dbPath);
    await RNFS.unlink(tempEncryptedDbPath);

    // Reopen as cipher
    dbInstance = await openCipherDatabase(dbKey);
    isDbEncrypted = true;
    console.log('[Database] SQLCipher migration completed successfully!');
    
    // Log success (CHANGE-20)
    const { logSecurityEvent } = require('../security/auditLogger');
    await logSecurityEvent('SECURITY_INFO', 'Database successfully migrated to SQLCipher.');

  } catch (error) {
    console.error('[Database] Migration process failed! Rolling back...', error);
    
    // Cleanup temporary files
    if (await RNFS.exists(tempEncryptedDbPath)) {
      try { await RNFS.unlink(tempEncryptedDbPath); } catch(e){}
    }

    // Fallback rollback: Restore unencrypted database (CHANGE-16)
    if (await RNFS.exists(backupDbPath)) {
      if (await RNFS.exists(dbPath)) {
        await RNFS.unlink(dbPath);
      }
      await RNFS.copyFile(backupDbPath, dbPath);
      await RNFS.unlink(backupDbPath);
      console.log('[Database] Fallback rollback completed: Unencrypted database restored.');
    }

    throw error;
  }
}

/**
 * SQLCipher Performance Benchmarking (CHANGE-13)
 */
async function benchmarkDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const startWrite = Date.now();
    // Perform a test insert
    await db.executeSql(
      "INSERT INTO audit_logs (event_type, description, timestamp) VALUES ('BENCHMARK', 'SQLCipher performance write benchmark test', ?);",
      [new Date().toISOString()]
    );
    const writeTime = Date.now() - startWrite;

    const startRead = Date.now();
    // Perform test read
    await db.executeSql("SELECT COUNT(*) FROM audit_logs WHERE event_type = 'BENCHMARK';");
    const readTime = Date.now() - startRead;

    // Prune benchmark rows to keep db clean
    await db.executeSql("DELETE FROM audit_logs WHERE event_type = 'BENCHMARK';");

    console.log(`[Database Benchmarking] Write: ${writeTime}ms, Read: ${readTime}ms`);
  } catch (e) {
    console.warn('[Database] Benchmarking failed', e);
  }
}

/**
 * Database schema migration helper
 */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const result = await db.executeSql('PRAGMA user_version;');
    let currentVersion = 0;
    if (result && result.length > 0 && result[0].rows && result[0].rows.length > 0) {
      const item = result[0].rows.item(0);
      currentVersion = Number(Object.values(item)[0]) || 0;
    }

    console.log(`[Database] Current database schema version: ${currentVersion}`);

    if (currentVersion < CURRENT_SCHEMA_VERSION) {
      if (currentVersion < 1) {
        await db.transaction((tx: any) => {
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              created_at TEXT
            );
          `);
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS embeddings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER,
              embedding BLOB,
              embedding_version TEXT,
              created_at TEXT,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
          `);
          tx.executeSql(`
            CREATE INDEX IF NOT EXISTS idx_user_id ON embeddings(user_id);
          `);
        });
        console.log('[Database] Database schema migrated to version 1');
      }

      if (currentVersion < 2) {
        await db.transaction((tx: any) => {
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS sync_queue (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              payload BLOB,
              payload_hash TEXT UNIQUE,
              status TEXT,
              retry_count INTEGER,
              last_retry_at TEXT,
              created_at TEXT
            );
          `);
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS audit_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              event_type TEXT NOT NULL,
              description TEXT,
              timestamp TEXT NOT NULL
            );
          `);
        });
        console.log('[Database] Database schema migrated to version 2');
      }

      await db.executeSql(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION};`);
      console.log(`[Database] Database user_version set to ${CURRENT_SCHEMA_VERSION}`);
    }
  } catch (error) {
    console.error('[Database] Migration failed:', error);
    throw error;
  }
}
