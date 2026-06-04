import { authenticateFace } from './authenticateFace';
import { getSecuredData, saveSecuredData } from '../security/secureStorage';

export { authenticateFace };

export type VerifyFaceParams = {
  currentEmbedding: Float32Array;
  activeUser: { id: number; name: string };
  storedEmbeddings: { [username: string]: Float32Array[] };
  matchThreshold: number;
};

export type VerifyFaceResult = {
  success: boolean;
  score: number;
  status: string;
};

export function verifyFaceAgainstUser({
  currentEmbedding,
  activeUser,
  storedEmbeddings,
  matchThreshold = 0.85,
}: VerifyFaceParams): VerifyFaceResult {
  const activeEmbeds = storedEmbeddings[activeUser.name] || [];
  if (activeEmbeds.length === 0) {
    return {
      success: false,
      score: 0,
      status: `Face detected. Register embeddings for ${activeUser.name}.`,
    };
  }

  const storedMap: { [key: string]: Float32Array } = {};
  activeEmbeds.forEach((emb, index) => {
    storedMap[`${activeUser.name}_${index}`] = emb;
  });

  const authResult = authenticateFace(currentEmbedding, storedMap, matchThreshold);
  
  return {
    success: authResult.success,
    score: authResult.score,
    status: authResult.success
      ? `✓ Face Verified. Welcome back, ${activeUser.name}`
      : `ACCESS DENIED: Face mismatch (${(authResult.score * 100).toFixed(0)}%)`,
  };
}

export async function incrementFailedAttempts(username: string, currentAttempts: number): Promise<number> {
  const nextAttempts = currentAttempts + 1;
  await saveSecuredData(`failed_attempts_${username}`, String(nextAttempts));
  return nextAttempts;
}

export async function clearFailedAttempts(username: string): Promise<void> {
  await saveSecuredData(`failed_attempts_${username}`, '0');
}
