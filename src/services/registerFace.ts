import { saveEmbedding } from './embeddingStorage';
import { normalizeEmbedding } from '../utils/cosineSimilarity';

export async function registerFace(userId: string, embedding: Float32Array): Promise<void> {
  if (embedding == null || embedding.length === 0) {
    throw new Error('No face embedding available to register.');
  }
  const normalized = normalizeEmbedding(embedding);
  await saveEmbedding(userId, normalized);
  console.log(`[Register] User profile created and saved for: ${userId}`);
}
