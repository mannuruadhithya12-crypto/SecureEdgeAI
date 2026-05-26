import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const DATABASE_NAME = 'SecureEdge.db';
const CURRENT_SCHEMA_VERSION = 1;

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await SQLite.openDatabase({
    name: DATABASE_NAME,
    location: 'default',
  });

  await runMigrations(dbInstance);
  return dbInstance;
}

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

      await db.executeSql(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION};`);
      console.log(`[Database] Database schema migrated successfully to version ${CURRENT_SCHEMA_VERSION}`);
    }
  } catch (error) {
    console.error('[Database] Migration failed:', error);
    throw error;
  }
}
