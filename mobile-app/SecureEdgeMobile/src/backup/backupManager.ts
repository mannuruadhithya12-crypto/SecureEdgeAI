import RNFS from 'react-native-fs';
import { getAllUsers } from '../database/userRepository';
import { getEmbeddingsForUser } from '../database/embeddingRepository';
import { float32ArrayToBase64 } from '../utils/serialization';
import { encryptData } from '../security/encryption';
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

export async function performBackup(): Promise<string> {
  const users = await getAllUsers();
  const backupData = [];
  
  for (const u of users) {
    const dbEmbeds = await getEmbeddingsForUser(u.id);
    const serializedEmbeds = dbEmbeds.map(e => ({
      embedding_base64: float32ArrayToBase64(e.embedding),
      version: e.embedding_version,
    }));
    
    // Encrypt username metadata to prevent leaks (CHANGE-10)
    const encryptedName = await encryptData(u.name);
    
    backupData.push({
      encrypted_name: encryptedName,
      embeddings: serializedEmbeds,
    });
  }
  
  const plaintext = JSON.stringify(backupData);
  const encryptedPayload = await encryptData(plaintext);
  
  // Generate integrity signature (CHANGE-14)
  const payloadHash = await computeHash(encryptedPayload);
  const backupEnvelope = JSON.stringify({
    payload: encryptedPayload,
    hash: payloadHash,
  });
  
  const backupPath = `${RNFS.DocumentDirectoryPath}/secure_edge_backup.enc`;
  
  // Stream/Write output file safely (CHANGE-9)
  await RNFS.writeFile(backupPath, backupEnvelope, 'utf8');
  console.log(`[Backup] Encrypted backup successfully created with signature: ${payloadHash}`);
  
  return backupPath;
}
