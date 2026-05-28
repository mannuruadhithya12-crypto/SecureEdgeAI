/**
 * Normalizes an embedding vector represented as a Float32Array to unit length.
 */
export function normalizeEmbedding(embedding: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < embedding.length; i++) {
    sumSq += embedding[i] * embedding[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0) {
    return embedding;
  }
  const normalized = new Float32Array(embedding.length);
  for (let i = 0; i < embedding.length; i++) {
    normalized[i] = embedding[i] / norm;
  }
  return normalized;
}

/**
 * Calculates the cosine similarity between two numeric vectors.
 * Supports Float32Array (from real ML pipeline) and number[] (from mock UI/QA helpers).
 * Returns a value between -1.0 and 1.0.
 */
export function cosineSimilarity(
  current: Float32Array | number[],
  reference: Float32Array | number[]
): number {
  if (!current || !reference || current.length !== reference.length || current.length === 0) {
    return 0.0;
  }

  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;

  for (let i = 0; i < current.length; i++) {
    const a = current[i];
    const b = reference[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0.0 || normB === 0.0) {
    return 0.0;
  }

  const score = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  console.log(`Similarity score: ${score.toFixed(2)}`);
  return score;
}
