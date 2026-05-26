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

export function cosineSimilarity(current: Float32Array, reference: Float32Array): number {
  const length = Math.min(current.length, reference.length);
  if (length === 0) {
    return 0;
  }

  let dot = 0;
  let currentNorm = 0;
  let referenceNorm = 0;

  for (let i = 0; i < length; i += 1) {
    const a = current[i];
    const b = reference[i];
    dot += a * b;
    currentNorm += a * a;
    referenceNorm += b * b;
  }

  if (currentNorm === 0 || referenceNorm === 0) {
    return 0;
  }

  const score = dot / (Math.sqrt(currentNorm) * Math.sqrt(referenceNorm));
  console.log(`Similarity score: ${score.toFixed(2)}`);
  return score;
}

