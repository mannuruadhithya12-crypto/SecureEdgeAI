import { getDatabase } from './database';

export interface User {
  id: number;
  name: string;
  created_at: string;
}

export async function createUser(name: string): Promise<number> {
  const db = await getDatabase();
  const createdAt = new Date().toISOString().split('T')[0];
  const result = await db.executeSql(
    'INSERT INTO users (name, created_at) VALUES (?, ?);',
    [name, createdAt]
  );
  
  if (result && result.length > 0) {
    return result[0].insertId;
  }
  throw new Error('Failed to create user');
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDatabase();
  const result = await db.executeSql('SELECT * FROM users ORDER BY name ASC;');
  const users: User[] = [];
  
  if (result && result.length > 0) {
    const rows = result[0].rows;
    for (let i = 0; i < rows.length; i++) {
      users.push(rows.item(i) as User);
    }
  }
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
  await db.executeSql('UPDATE users SET name = ? WHERE id = ?;', [newName, id]);
}
