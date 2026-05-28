import { saveEmbedding, loadEmbedding } from './embeddingStorage';

interface RegistrationResult {
  success: boolean;
  error?: string;
}

/**
 * Registers a new user with their face embedding template locally.
 */
export async function registerUser(
  name: string,
  employeeId: string,
  embedding: number[]
): Promise<RegistrationResult> {
  // 1. Inputs validation
  if (!name.trim()) {
    return { success: false, error: 'Full name is required for registration.' };
  }
  if (!employeeId.trim()) {
    return { success: false, error: 'Employee ID is required.' };
  }
  if (!embedding || embedding.length !== 192) {
    return { success: false, error: 'Invalid face embedding signature. Vector length must be 192.' };
  }

  try {
    // 2. Check if user already exists
    const existing = await loadEmbedding(employeeId);
    if (existing) {
      return { success: false, error: `Employee ID "${employeeId}" is already registered on this device.` };
    }

    // 3. Save the new user record
    const saved = await saveEmbedding(name, employeeId, embedding);
    if (saved) {
      console.log('[RegisterUser] Registration success!');
      console.log(`  - Employee ID: ${employeeId}`);
      console.log(`  - Name: ${name}`);
      console.log(`  - Embedding vector length: ${embedding.length}`);
      console.log(`  - Saved embedding values snippet: [${embedding.slice(0, 5).join(', ')}, ...]`);
      return { success: true };
    } else {
      return { success: false, error: 'Failed to write record to local SQLite storage.' };
    }
  } catch (error: any) {
    console.error('[RegisterUser] Error during registration:', error);
    return { success: false, error: error.message || 'An unexpected error occurred during enrollment.' };
  }
}
