import RNFS from 'react-native-fs';
import { createUser, getAllUsers } from '../database/userRepository';
import { insertEmbedding } from '../database/embeddingRepository';
import { base64ToFloat32Array } from '../utils/serialization';
import { decryptData } from '../security/encryption';
import Aes from 'react-native-aes-crypto';

async function computeHash(text: string): Promise<string> {
  try {
    return await Aes.sha256(text);
  } catch (error) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return 'fallback_hash_' + Math.abs(hash).toString(16);
  }
}

export async function performRestore(backupPath: string): Promise<void> {
  // Check if file exists
  const exists = await RNFS.exists(backupPath);
  if (!exists) {
    throw new Error('Backup file not found at path: ' + backupPath);
  }

  // Stream/read backup file safely (CHANGE-9)
  const fileContent = await RNFS.readFile(backupPath, 'utf8');
  let envelope;
  try {
    envelope = JSON.parse(fileContent);
  } catch (e) {
    throw new Error('Invalid backup file format: not valid JSON');
  }

  if (!envelope || typeof envelope.payload !== 'string' || typeof envelope.hash !== 'string') {
    throw new Error('Invalid backup envelope schema');
  }

  // Verify backup integrity (CHANGE-14)
  const computed = await computeHash(envelope.payload);
  if (computed !== envelope.hash) {
    throw new Error('Backup integrity validation failed (mismatched SHA-256 signature). The file might be corrupted or tampered with.');
  }

  // Decrypt backup payload (CHANGE-10)
  let decryptedText: string;
  try {
    decryptedText = await decryptData(envelope.payload);
  } catch (e) {
    throw new Error('Failed to decrypt backup payload. Encryption key might be incorrect.');
  }

  let backupData: any[];
  try {
    backupData = JSON.parse(decryptedText);
  } catch (e) {
    throw new Error('Failed to parse decrypted backup payload');
  }

  if (!Array.isArray(backupData)) {
    throw new Error('Backup payload is not an array of profiles');
  }

  // Fetch current users to prevent duplicate user creation
  const currentUsers = await getAllUsers();
  
  for (const item of backupData) {
    if (!item.encrypted_name || !Array.isArray(item.embeddings)) {
      continue;
    }

    // Decrypt username metadata (CHANGE-10)
    let userName: string;
    try {
      userName = await decryptData(item.encrypted_name);
    } catch (e) {
      console.warn('[Restore] Failed to decrypt username metadata for a record, skipping');
      continue;
    }

    // Check if user already exists
    let user = currentUsers.find(u => u.name.toLowerCase() === userName.toLowerCase());
    let userId = user ? user.id : 0;

    if (!user) {
      // Create user
      userId = await createUser(userName);
    }

    // Restore embeddings
    for (const embData of item.embeddings) {
      if (!embData.embedding_base64 || !embData.version) {
        continue;
      }
      try {
        const floatArray = base64ToFloat32Array(embData.embedding_base64);
        await insertEmbedding(userId, floatArray, embData.version);
      } catch (e) {
        console.error(`[Restore] Failed to restore embedding for user ${userName}:`, e);
      }
    }
  }

  console.log('[Restore] Backup successfully restored into database');
}
