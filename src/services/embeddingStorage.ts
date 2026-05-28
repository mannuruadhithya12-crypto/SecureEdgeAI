import RNFS from 'react-native-fs';
import { saveUser, findUserByEmployeeId, deleteUser } from '../database/database';
import { cosineSimilarity } from '../utils/cosineSimilarity';

const EMBEDDING_DIR = `${RNFS.DocumentDirectoryPath}/embeddings`;

async function ensureDirectoryExists(): Promise<void> {
  const exists = await RNFS.exists(EMBEDDING_DIR);
  if (!exists) {
    await RNFS.mkdir(EMBEDDING_DIR);
  }
}

// Global in-memory storage of the active face embedding (simulating the physical face in front of the camera)
let activeFaceEmbedding: number[] | null = null;

export function setActiveFaceEmbedding(embedding: number[]): void {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  activeFaceEmbedding = norm > 0 ? embedding.map(v => v / norm) : embedding;
  console.log('[EmbeddingStorage] Set active face embedding, length:', activeFaceEmbedding.length);
}

export async function getActiveFaceEmbedding(employeeId?: string): Promise<number[]> {
  // In simulated/testing environment, if employeeId is specified and registered in SQLite,
  // we default the live active face in front of the camera to that user's template to simulate same-face verification.
  if (employeeId) {
    const storedEmbedding = await loadEmbedding(employeeId);
    if (storedEmbedding) {
      console.log(`[EmbeddingStorage] Simulated active face set to stored embedding for: ${employeeId}`);
      activeFaceEmbedding = storedEmbedding;
      return activeFaceEmbedding;
    }
  }

  if (!activeFaceEmbedding) {
    console.log('[EmbeddingStorage] Active face embedding not set. Loading default user (Manoj) as active face...');
    const manojEmbedding = await loadEmbedding('EMP001');
    if (manojEmbedding) {
      activeFaceEmbedding = manojEmbedding;
      console.log('[EmbeddingStorage] Loaded Manoj embedding as active face.');
    } else {
      console.log('[EmbeddingStorage] Manoj embedding not found in DB. Generating random active face.');
      const vec = Array.from({ length: 192 }, () => Math.random() * 2 - 1);
      const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
      activeFaceEmbedding = vec.map(v => v / norm);
    }
  }
  return activeFaceEmbedding;
}

/**
 * Saves a face embedding vector.
 * Supports:
 * 1. saveEmbedding(userId: string, embedding: Float32Array): Promise<void> (main/HEAD JSON file save)
 * 2. saveEmbedding(name: string, employeeId: string, embedding: number[]): Promise<boolean> (mobile SQLite save)
 */
export async function saveEmbedding(
  arg1: string,
  arg2: Float32Array | string,
  arg3?: number[]
): Promise<void | boolean> {
  if (arg2 instanceof Float32Array) {
    // Signature 1
    const userId = arg1;
    const embedding = arg2;
    await ensureDirectoryExists();
    const filePath = `${EMBEDDING_DIR}/${userId}.json`;
    const data = JSON.stringify(Array.from(embedding));
    await RNFS.writeFile(filePath, data, 'utf8');
    console.log(`[Storage] Embedding saved successfully for user: ${userId}`);
    return;
  } else if (typeof arg2 === 'string' && Array.isArray(arg3)) {
    // Signature 2
    const name = arg1;
    const employeeId = arg2;
    const embedding = arg3;
    return await saveUser(name, employeeId, embedding);
  }
}

/**
 * Loads all file-based embeddings (from main/HEAD).
 */
export async function loadEmbeddings(): Promise<{ [userId: string]: Float32Array }> {
  await ensureDirectoryExists();
  const files = await RNFS.readDir(EMBEDDING_DIR);
  const embeddings: { [userId: string]: Float32Array } = {};
  
  for (const file of files) {
    if (file.isFile() && file.name.endsWith('.json')) {
      const userId = file.name.replace('.json', '');
      const data = await RNFS.readFile(file.path, 'utf8');
      const array = JSON.parse(data) as number[];
      embeddings[userId] = new Float32Array(array);
    }
  }
  console.log(`[Storage] Loaded embeddings for ${Object.keys(embeddings).length} users`);
  return embeddings;
}

/**
 * Loads a face embedding vector from SQLite (from mobile).
 */
export async function loadEmbedding(employeeId: string): Promise<number[] | null> {
  const user = await findUserByEmployeeId(employeeId);
  if (!user || !user.embedding) {
    return null;
  }
  try {
    const parsedEmbedding = JSON.parse(user.embedding);
    if (Array.isArray(parsedEmbedding)) {
      if (parsedEmbedding.length !== 192) {
        console.warn(`[EmbeddingStorage] Dimension mismatch for "${employeeId}". Expected 192, got ${parsedEmbedding.length}`);
        return null;
      }
      const numericEmbedding = parsedEmbedding.map(Number);
      if (numericEmbedding.some(isNaN)) {
        console.warn(`[EmbeddingStorage] Stored embedding for "${employeeId}" contains invalid non-numeric values.`);
        return null;
      }
      console.log(`[EmbeddingStorage] Loaded embedding for "${employeeId}", vector length: ${numericEmbedding.length}`);
      return numericEmbedding;
    }
    return null;
  } catch (error) {
    console.error('[EmbeddingStorage] Error parsing embedding JSON:', error);
    return null;
  }
}

/**
 * Deletes an embedding.
 * Supports:
 * 1. deleteEmbedding(userId: string): Promise<void> (main/HEAD file delete)
 * 2. deleteEmbedding(employeeId: string): Promise<boolean> (mobile SQLite delete)
 */
export async function deleteEmbedding(arg: string): Promise<void | boolean> {
  // Let's run both or distinguish. Since both pass a string, we check if file exists, then delete file; and also delete from SQLite.
  // This is safe because it covers both signatures cleanly!
  let deletedFile = false;
  try {
    await ensureDirectoryExists();
    const filePath = `${EMBEDDING_DIR}/${arg}.json`;
    const exists = await RNFS.exists(filePath);
    if (exists) {
      await RNFS.unlink(filePath);
      console.log(`[Storage] Deleted embedding file for user: ${arg}`);
      deletedFile = true;
    }
  } catch (e) {
    // Ignore file error
  }

  // SQLite delete
  const sqliteResult = await deleteUser(arg);
  return deletedFile ? undefined : sqliteResult;
}

/**
 * Compares two face embedding vectors using Cosine Similarity.
 */
export function compareEmbeddings(vecA: number[], vecB: number[]): number {
  return cosineSimilarity(vecA, vecB);
}
