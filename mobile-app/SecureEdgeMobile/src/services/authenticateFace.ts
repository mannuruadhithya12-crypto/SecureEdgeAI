import { cosineSimilarity, normalizeEmbedding } from '../utils/cosineSimilarity';

export type AuthResult = {
  success: boolean;
  userId?: string;
  score: number;
};

export function authenticateFace(
  currentEmbedding: Float32Array,
  storedEmbeddings: { [userId: string]: Float32Array },
  matchThreshold: number
): AuthResult {
  let bestScore = -Infinity;
  let bestUserId: string | undefined;

  const normalizedCurrent = normalizeEmbedding(currentEmbedding);
  const userIds = Object.keys(storedEmbeddings);

  for (const userId of userIds) {
    const normalizedReference = normalizeEmbedding(storedEmbeddings[userId]);
    const score = cosineSimilarity(normalizedCurrent, normalizedReference);
    if (score > bestScore) {
      bestScore = score;
      bestUserId = userId;
    }
  }

  const success = bestScore >= matchThreshold;
  if (success && bestUserId != null) {
    console.log(`[Auth] ACCESS GRANTED for user: ${bestUserId} (Score: ${bestScore.toFixed(4)})`);
    console.log('ACCESS GRANTED');
  } else if (userIds.length > 0) {
    console.log(`[Auth] ACCESS DENIED. Best score: ${bestScore.toFixed(4)} (Threshold: ${matchThreshold})`);
    console.log('ACCESS DENIED');
  }

  return {
    success,
    userId: bestUserId,
    score: bestScore === -Infinity ? 0 : bestScore,
  };
}
