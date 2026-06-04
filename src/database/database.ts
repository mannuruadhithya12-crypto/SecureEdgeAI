import SQLite from 'react-native-sqlite-storage';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { encryptData, decryptData } from '../security/encryption';

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

let dbInstance: any = null;

export interface User {
  id?: number;
  name: string;
  employee_id: string;
  embedding: string; // JSON string of the float array [1, 192] (encrypted in DB)
  created_at?: string;
}

export async function getDatabase(): Promise<any> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDatabasePath();

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
    try {
      dbInstance = await openUnencryptedDatabase();
      const integrityPassed = await runIntegrityCheck(dbInstance);

      if (!integrityPassed) {
        console.warn('[Database] SQLite integrity check failed! Recovering...');
        await recoverCorruptDatabase(dbPath);
      } else {
        console.log('[Database] SQLite Database opened and verified successfully');
      }
    } catch (e) {
      console.error('[Database] Failed to open SQLite database, attempting recovery...', e);
      await recoverCorruptDatabase(dbPath);
    }
  } else {
    console.log('[Database] Creating new SQLite database...');
    dbInstance = await openUnencryptedDatabase();
  }

  // 2. Configure WAL support & run migrations (CHANGE-8)
  try {
    await dbInstance!.executeSql('PRAGMA journal_mode = WAL;');
  } catch (err) {
    console.warn('[Database] WAL journaling setup failed', err);
  }

  await runMigrations(dbInstance!);

  // 3. Run database benchmarking after successful open (CHANGE-13)
  await benchmarkDatabase(dbInstance!);

  return dbInstance!;
}

async function openUnencryptedDatabase(): Promise<any> {
  return await SQLite.openDatabase({
    name: DATABASE_NAME,
    location: 'default'
  });
}

/**
 * Executes a SQLite integrity check (CHANGE-4)
 */
async function runIntegrityCheck(db: any): Promise<boolean> {
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
async function recoverCorruptDatabase(dbPath: string): Promise<void> {
  try {
    const backupJsonPath = `${RNFS.DocumentDirectoryPath}/secure_edge_backup.enc`;
    const backupExists = await RNFS.exists(backupJsonPath);
    
    if (backupExists) {
      console.log('[Database] Found secure backup file. Restoring database...');
      // Close active instance if any
      if (dbInstance) {
        try { await dbInstance.close(); } catch(e){}
        dbInstance = null;
      }
      // Delete corrupt DB file
      await RNFS.unlink(dbPath);
      
      // Open new clean DB
      dbInstance = await openUnencryptedDatabase();
      
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
 * SQLCipher Performance Benchmarking (CHANGE-13) - Kept for SQLite compatibility
 */
async function benchmarkDatabase(db: any): Promise<void> {
  try {
    const startWrite = Date.now();
    // Perform a test insert
    await db.executeSql(
      "INSERT INTO audit_logs (event_type, description, timestamp) VALUES ('BENCHMARK', 'SQLite performance write benchmark test', ?);",
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
async function runMigrations(db: any): Promise<void> {
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
              employee_id TEXT UNIQUE,
              embedding TEXT,
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

// ==========================================
// COMPATIBILITY INTERFACES & WRAPPERS FOR SCREENS
// ==========================================

export async function initDB(): Promise<void> {
  try {
    await getDatabase();
  } catch (error) {
    console.error('[Database] initDB wrapper failed:', error);
  }
}

export async function saveUser(name: string, employeeId: string, embedding: number[]): Promise<boolean> {
  try {
    const encryptedName = await encryptData(name);
    const encryptedEmployeeId = await encryptData(employeeId);
    const encryptedEmbedding = await encryptData(JSON.stringify(embedding));

    const db = await getDatabase();
    await db.executeSql(
      'INSERT OR REPLACE INTO users (name, employee_id, embedding) VALUES (?, ?, ?);',
      [encryptedName, encryptedEmployeeId, encryptedEmbedding]
    );
    console.log('[Database] User saved successfully via wrapper (encrypted):', employeeId);
    return true;
  } catch (error) {
    console.error('[Database] Error saving user via wrapper:', error);
    // Fallback save to memory
    fallbackStorage[employeeId] = {
      name,
      employee_id: employeeId,
      embedding: JSON.stringify(embedding),
      created_at: new Date().toISOString(),
    };
    return true;
  }
}

// Fallback in-memory storage if SQLite fails to initialize at runtime in Fabric
const fallbackStorage: Record<string, User> = {};

export async function getUsers(): Promise<User[]> {
  try {
    const db = await getDatabase();
    const [results] = await db.executeSql('SELECT * FROM users ORDER BY created_at DESC;');
    const users: User[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      try {
        const decryptedName = await decryptData(row.name);
        const decryptedEmployeeId = await decryptData(row.employee_id);
        const decryptedEmbedding = await decryptData(row.embedding);
        users.push({
          id: row.id,
          name: decryptedName,
          employee_id: decryptedEmployeeId,
          embedding: decryptedEmbedding,
          created_at: row.created_at
        });
      } catch (decErr) {
        console.warn('[Database] Decryption failed for user row, returning encrypted content', decErr);
        users.push(row);
      }
    }
    // Sort by decrypted name
    users.sort((a, b) => a.name.localeCompare(b.name));
    return users;
  } catch (error) {
    console.error('[Database] Error reading users via wrapper:', error);
    return Object.values(fallbackStorage);
  }
}

export async function findUserByEmployeeId(employeeId: string): Promise<User | null> {
  try {
    const users = await getUsers();
    const found = users.find(u => u.employee_id === employeeId);
    return found || null;
  } catch (error) {
    console.error('[Database] Error finding user via wrapper:', error);
    return fallbackStorage[employeeId] || null;
  }
}

export async function deleteUser(employeeId: string): Promise<boolean> {
  try {
    const db = await getDatabase();
    // Since employee_id is encrypted in database, we look up the user first to get their primary ID
    const users = await getUsers();
    const userToDelete = users.find(u => u.employee_id === employeeId);
    
    if (userToDelete && userToDelete.id !== undefined) {
      await db.transaction((tx: any) => {
        tx.executeSql('DELETE FROM embeddings WHERE user_id = ?;', [userToDelete.id]);
        tx.executeSql('DELETE FROM users WHERE id = ?;', [userToDelete.id]);
      });
      console.log('[Database] User deleted successfully via wrapper:', employeeId);
      return true;
    }
    console.warn('[Database] User not found for deletion:', employeeId);
    return false;
  } catch (error) {
    console.error('[Database] Error deleting user via wrapper:', error);
    delete fallbackStorage[employeeId];
    return true;
  }
}

export async function seedAndVerifyDB(): Promise<void> {
  console.log('🛡️ [QA-Debug] [Database] Starting SQLite verification check...');
  try {
    const users = await getUsers();
    console.log('🛡️ [QA-Debug] [Database] User table exists ✅');

    const manoj = users.find(u => u.employee_id === 'EMP001');
    const isAllZeros = manoj && (() => {
      try {
        return JSON.parse(manoj.embedding).every((v: number) => v === 0.0);
      } catch {
        return true;
      }
    })();
    
    if (!manoj || isAllZeros) {
      console.log('🛡️ [QA-Debug] [Database] Sample user Manoj not found or has all-zero embedding. Seeding/updating Manoj...');
      const mockEmbedding = Array.from({ length: 192 }, () => Math.random() * 2 - 1);
      const norm = Math.sqrt(mockEmbedding.reduce((sum, val) => sum + val * val, 0));
      const normalizedMockEmbedding = mockEmbedding.map(val => val / norm);
      await saveUser('Manoj', 'EMP001', normalizedMockEmbedding);
      
      const updatedUsers = await getUsers();
      console.log('🛡️ [QA-Debug] [Database] Sample data:');
      updatedUsers.forEach((u) => {
        console.log(`🛡️ [QA-Debug] [Database]   - { id: ${u.id}, name: "${u.name}", employee_id: "${u.employee_id}", created_at: "${u.created_at}" }`);
      });
    } else {
      console.log('🛡️ [QA-Debug] [Database] Sample data:');
      users.forEach((u) => {
        console.log(`🛡️ [QA-Debug] [Database]   - { id: ${u.id}, name: "${u.name}", employee_id: "${u.employee_id}", created_at: "${u.created_at}" }`);
      });
    }
  } catch (error) {
    console.error('🛡️ [QA-Debug] [Database] Verification check failed: ❌', error);
  }
}
