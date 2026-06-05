import { getDatabase } from './database';
import { encryptData, decryptData } from '../security/encryption';
import { float32ArrayToBase64, base64ToFloat32Array } from '../utils/serialization';

function stringToHex(str: string): string {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToString(hex: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
}


export interface EmbeddingRow {
  id: number;
  user_id: number;
  embedding: Float32Array;
  embedding_version: string;
  created_at: string;
}

export async function insertEmbedding(userId: number, embedding: Float32Array, version: string): Promise<void> {
  const db = await getDatabase();
  const serialized = float32ArrayToBase64(embedding);
  const encrypted = await encryptData(serialized);
  const hex = stringToHex(encrypted);
  const createdAt = new Date().toISOString().split('T')[0];

  await db.executeSql(
    `INSERT INTO embeddings (user_id, embedding, embedding_version, created_at) VALUES (?, x'${hex}', ?, ?);`,
    [userId, version, createdAt]
  );
  console.log(`[Repository] Embedding saved successfully in SQLite for user ID: ${userId}`);
}

export async function getEmbedding(id: number): Promise<EmbeddingRow | null> {
  const db = await getDatabase();
  const result = await db.executeSql(
    'SELECT id, user_id, hex(embedding) as embedding_hex, embedding_version, created_at FROM embeddings WHERE id = ?;',
    [id]
  );

  if (result && result.length > 0 && result[0].rows.length > 0) {
    const row = result[0].rows.item(0);
    const decryptedBase64 = await decryptData(hexToString(row.embedding_hex));
    const Float32Arr = base64ToFloat32Array(decryptedBase64);

    return {
      id: row.id,
      user_id: row.user_id,
      embedding: Float32Arr,
      embedding_version: row.embedding_version,
      created_at: row.created_at,
    };
  }
  return null;
}

export async function deleteEmbedding(id: number): Promise<void> {
  const db = await getDatabase();
  await db.executeSql('DELETE FROM embeddings WHERE id = ?;', [id]);
}

export async function updateEmbedding(id: number, embedding: Float32Array, version: string): Promise<void> {
  const db = await getDatabase();
  const serialized = float32ArrayToBase64(embedding);
  const encrypted = await encryptData(serialized);
  const hex = stringToHex(encrypted);
  
  await db.executeSql(
    `UPDATE embeddings SET embedding = x'${hex}', embedding_version = ? WHERE id = ?;`,
    [version, id]
  );
}

export async function getEmbeddingsForUser(userId: number): Promise<EmbeddingRow[]> {
  const db = await getDatabase();
  const result = await db.executeSql(
    'SELECT id, user_id, hex(embedding) as embedding_hex, embedding_version, created_at FROM embeddings WHERE user_id = ?;',
    [userId]
  );
  
  const list: EmbeddingRow[] = [];
  if (result && result.length > 0) {
    const rows = result[0].rows;
    for (let i = 0; i < rows.length; i++) {
      const row = rows.item(i);
      const decryptedBase64 = await decryptData(hexToString(row.embedding_hex));
      const Float32Arr = base64ToFloat32Array(decryptedBase64);
      
      list.push({
        id: row.id,
        user_id: row.user_id,
        embedding: Float32Arr,
        embedding_version: row.embedding_version,
        created_at: row.created_at,
      });
    }
  }
  return list;
}
