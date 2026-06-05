import { getDatabase } from './database';
import { encryptData, decryptData } from '../security/encryption';

export interface User {
  id: number;
  name: string;
  employee_id?: string;
  created_at: string;
}

export async function createUser(name: string, employeeId?: string): Promise<number> {
  const db = await getDatabase();
  const encryptedName = await encryptData(name);
  const encryptedEmpId = employeeId ? await encryptData(employeeId) : null;
  const createdAt = new Date().toISOString().split('T')[0];
  const result = await db.executeSql(
    'INSERT INTO users (name, employee_id, created_at) VALUES (?, ?, ?);',
    [encryptedName, encryptedEmpId, createdAt]
  );
  
  if (result && result.length > 0) {
    return result[0].insertId;
  }
  throw new Error('Failed to create user');
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDatabase();
  const result = await db.executeSql('SELECT * FROM users;');
  const users: User[] = [];
  
  if (result && result.length > 0) {
    const rows = result[0].rows;
    for (let i = 0; i < rows.length; i++) {
      const row = rows.item(i);
      try {
        const decryptedName = await decryptData(row.name);
        let decryptedEmpId = undefined;
        if (row.employee_id) {
          decryptedEmpId = await decryptData(row.employee_id);
        }
        users.push({
          id: row.id,
          name: decryptedName,
          employee_id: decryptedEmpId,
          created_at: row.created_at
        });
      } catch (e) {
        users.push(row);
      }
    }
  }
  // Sort in JS because encrypted sorting is not lexicographically alphabetical
  users.sort((a, b) => a.name.localeCompare(b.name));
  return users;
}

export async function deleteUser(id: number): Promise<void> {
  const db = await getDatabase();
  await db.transaction((tx: any) => {
    tx.executeSql('DELETE FROM embeddings WHERE user_id = ?;', [id]);
    tx.executeSql('DELETE FROM users WHERE id = ?;', [id]);
  });
}

export async function renameUser(id: number, newName: string): Promise<void> {
  const db = await getDatabase();
  const encryptedName = await encryptData(newName);
  await db.executeSql('UPDATE users SET name = ? WHERE id = ?;', [encryptedName, id]);
}
