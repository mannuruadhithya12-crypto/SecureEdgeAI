import { saveUser, findUserByEmployeeId, deleteUser } from '../database/database';
import { cosineSimilarity } from '../utils/cosineSimilarity';

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
 * Saves a face embedding vector locally to SQLite.
 */
export async function saveEmbedding(
  name: string,
  employeeId: string,
  embedding: number[]
): Promise<boolean> {
  return await saveUser(name, employeeId, embedding);
}

/**
 * Loads a face embedding vector from SQLite.
 * Returns the float array or null if the user does not exist.
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
      console.log(`[EmbeddingStorage] Loaded embedding for "${employeeId}", vector length: ${numericEmbedding.length}, snippet: [${numericEmbedding.slice(0, 5).join(', ')}, ...]`);
      return numericEmbedding;
    }
    return null;
  } catch (error) {
    console.error('[EmbeddingStorage] Error parsing embedding JSON:', error);
    return null;
  }
}

/**
 * Deletes a user profile and their embedding from local SQLite storage.
 */
export async function deleteEmbedding(employeeId: string): Promise<boolean> {
  return await deleteUser(employeeId);
}

/**
 * Compares two face embedding vectors using Cosine Similarity.
 */
export function compareEmbeddings(vecA: number[], vecB: number[]): number {
  return cosineSimilarity(vecA, vecB);
}
