import { loadEmbedding, compareEmbeddings } from './embeddingStorage';
import { findUserByEmployeeId } from '../database/database';

interface AuthenticationResult {
  success: boolean;
  decision: 'valid' | 'uncertain' | 'reject';
  similarity: number;
  error?: string;
  name?: string;
}

const COSINE_THRESHOLD_VALID = 0.85;
const COSINE_THRESHOLD_UNCERTAIN = 0.70;

/**
 * Authenticates an employee by comparing their live captured face embedding
 * against the registered local SQLite database template.
 */
export async function authenticateUser(
  employeeId: string,
  capturedEmbedding: number[]
): Promise<AuthenticationResult> {
  if (!employeeId.trim()) {
    return { success: false, decision: 'reject', similarity: 0.0, error: 'Employee ID is required.' };
  }
  if (!capturedEmbedding || capturedEmbedding.length !== 192) {
    return { success: false, decision: 'reject', similarity: 0.0, error: 'Invalid captured face signature. Vector length must be 192.' };
  }

  try {
    // 1. Load the registered user and embedding template
    const user = await findUserByEmployeeId(employeeId);
    if (!user) {
      return {
        success: false,
        decision: 'reject',
        similarity: 0.0,
        error: `Employee ID "${employeeId}" not found on this device.`,
      };
    }

    const storedEmbedding = await loadEmbedding(employeeId);
    if (!storedEmbedding) {
      return {
        success: false,
        decision: 'reject',
        similarity: 0.0,
        error: `Invalid or missing template embedding for Employee ID "${employeeId}".`,
      };
    }

    // 2. Compute similarity score
    const similarity = compareEmbeddings(capturedEmbedding, storedEmbedding);
    
    // Task-requested debug logs
    console.log('🛡️ [QA-Debug] [AuthenticateUser] Matching calculation logs:');
    console.log(`🛡️ [QA-Debug]   - Target User ID: ${employeeId}`);
    console.log(`🛡️ [QA-Debug]   - Registered User Name: ${user.name}`);
    console.log(`🛡️ [QA-Debug]   - Stored embedding dimension: ${storedEmbedding.length}`);
    console.log(`🛡️ [QA-Debug]   - Live captured embedding dimension: ${capturedEmbedding.length}`);
    console.log(`🛡️ [QA-Debug]   - Cosine Similarity score: ${similarity.toFixed(4)}`);
    console.log(`🛡️ [QA-Debug]   - Match threshold (valid): ${COSINE_THRESHOLD_VALID}`);
    console.log(`🛡️ [QA-Debug]   - Match threshold (uncertain): ${COSINE_THRESHOLD_UNCERTAIN}`);
    
    // 3. Make decision based on hackathon thresholds
    let decision: 'valid' | 'uncertain' | 'reject';
    let success = false;

    if (similarity >= COSINE_THRESHOLD_VALID) {
      decision = 'valid';
      success = true;
    } else if (similarity >= COSINE_THRESHOLD_UNCERTAIN) {
      decision = 'uncertain';
      success = true; // In some flows uncertain may trigger secondary check, but counts as partial match
    } else {
      decision = 'reject';
      success = false;
    }

    return {
      success,
      decision,
      similarity,
      name: user.name,
    };
  } catch (error: any) {
    console.error('🛡️ [QA-Debug] [AuthenticateUser] Error during authentication matching:', error);
    return {
      success: false,
      decision: 'reject',
      similarity: 0.0,
      error: error.message || 'An unexpected error occurred during biometric match calculation.',
    };
  }
}
