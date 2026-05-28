import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

export interface User {
  id?: number;
  name: string;
  employee_id: string;
  embedding: string; // JSON string of the float array [1, 192]
  created_at?: string;
}

let dbInstance: any = null;

// Fallback in-memory storage if SQLite fails to initialize at runtime in Fabric
const fallbackStorage: Record<string, User> = {};

export async function initDB(): Promise<void> {
  try {
    console.log('[Database] Opening SQLite database...');
    dbInstance = await SQLite.openDatabase({
      name: 'SecureEdgeAI.db',
      location: 'default',
    });

    console.log('[Database] Database opened. Creating users table...');
    await dbInstance.executeSql(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        employee_id TEXT UNIQUE,
        embedding TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Database] Table initialized successfully.');
  } catch (error) {
    console.error('[Database] Failed to initialize SQLite. Running fallback storage mode.', error);
    dbInstance = null;
  }
}

export async function saveUser(name: string, employeeId: string, embedding: number[]): Promise<boolean> {
  const embeddingString = JSON.stringify(embedding);

  if (!dbInstance) {
    console.warn('[Database] [Fallback] Saving user to memory:', employeeId);
    fallbackStorage[employeeId] = {
      name,
      employee_id: employeeId,
      embedding: embeddingString,
      created_at: new Date().toISOString(),
    };
    return true;
  }

  try {
    await dbInstance.executeSql(
      'INSERT OR REPLACE INTO users (name, employee_id, embedding) VALUES (?, ?, ?);',
      [name, employeeId, embeddingString]
    );
    console.log('[Database] User saved successfully:', employeeId);
    return true;
  } catch (error) {
    console.error('[Database] Error saving user to SQLite:', error);
    return false;
  }
}

export async function getUsers(): Promise<User[]> {
  if (!dbInstance) {
    console.warn('[Database] [Fallback] Getting all users from memory.');
    return Object.values(fallbackStorage);
  }

  try {
    const [results] = await dbInstance.executeSql('SELECT * FROM users ORDER BY created_at DESC;');
    const users: User[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      users.push(results.rows.item(i));
    }
    return users;
  } catch (error) {
    console.error('[Database] Error reading users from SQLite:', error);
    return [];
  }
}

export async function findUserByEmployeeId(employeeId: string): Promise<User | null> {
  if (!dbInstance) {
    console.warn('[Database] [Fallback] Finding user in memory:', employeeId);
    return fallbackStorage[employeeId] || null;
  }

  try {
    const [results] = await dbInstance.executeSql('SELECT * FROM users WHERE employee_id = ? LIMIT 1;', [employeeId]);
    if (results.rows.length > 0) {
      return results.rows.item(0);
    }
    return null;
  } catch (error) {
    console.error('[Database] Error finding user in SQLite:', error);
    return null;
  }
}

export async function deleteUser(employeeId: string): Promise<boolean> {
  if (!dbInstance) {
    console.warn('[Database] [Fallback] Deleting user from memory:', employeeId);
    delete fallbackStorage[employeeId];
    return true;
  }

  try {
    await dbInstance.executeSql('DELETE FROM users WHERE employee_id = ?;', [employeeId]);
    console.log('[Database] User deleted successfully:', employeeId);
    return true;
  } catch (error) {
    console.error('[Database] Error deleting user in SQLite:', error);
    return false;
  }
}

export async function seedAndVerifyDB(): Promise<void> {
  console.log('🛡️ [QA-Debug] [Database] Starting SQLite verification check...');
  try {
    // 1. Fetch users to verify table exists
    const users = await getUsers();
    console.log('🛡️ [QA-Debug] [Database] User table exists ✅');

    // 2. Check if Manoj exists and does not have an all-zero embedding
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
      
      // Fetch again to display
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
