import * as Keychain from 'react-native-keychain';
import EncryptedStorage from 'react-native-encrypted-storage';

const KEY_ALIAS = 'SecureEdgeMobileEncryptionKey';

function generateRandomKey(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function getEncryptionKey(): Promise<string> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: KEY_ALIAS,
    });
    if (credentials) {
      return credentials.password;
    }

    const newKey = generateRandomKey();
    await Keychain.setGenericPassword('encryption_key', newKey, {
      service: KEY_ALIAS,
    });
    return newKey;
  } catch (error) {
    console.warn('[SecureStorage] Keystore access error. Using fallback key for testing.', error);
    return 'fallback_secure_key_1234567890abcdef1234567890abcdef';
  }
}

export async function saveSecuredData(key: string, value: string): Promise<void> {
  try {
    await EncryptedStorage.setItem(key, value);
  } catch (error) {
    console.error(`[SecureStorage] Failed to save secured data for key ${key}:`, error);
  }
}

export async function getSecuredData(key: string): Promise<string | null> {
  try {
    return await EncryptedStorage.getItem(key);
  } catch (error) {
    console.error(`[SecureStorage] Failed to get secured data for key ${key}:`, error);
    return null;
  }
}

export async function deleteSecuredData(key: string): Promise<void> {
  try {
    await EncryptedStorage.removeItem(key);
  } catch (error) {
    console.error(`[SecureStorage] Failed to delete secured data for key ${key}:`, error);
  }
}
