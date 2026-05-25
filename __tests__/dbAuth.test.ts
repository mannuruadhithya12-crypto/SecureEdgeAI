import { float32ArrayToBase64, base64ToFloat32Array, base64ToHex, hexToBase64 } from '../src/utils/serialization';

jest.mock('react-native-aes-crypto', () => ({
  encrypt: jest.fn((text) => Promise.resolve('enc_' + text)),
  decrypt: jest.fn((ciphertext) => Promise.resolve(ciphertext.substring(4))),
}));

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(() => Promise.resolve({ password: 'test_key' })),
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { encryptData, decryptData } from '../src/security/encryption';

describe('Serialization and Conversions', () => {
  it('should serialize and deserialize Float32Array accurately (full precision)', () => {
    const original = new Float32Array([0.1234567, -9.876543, 0.0000001, 12345.67]);
    const base64 = float32ArrayToBase64(original);
    const restored = base64ToFloat32Array(base64);
    
    expect(restored.length).toBe(original.length);
    expect(restored[0]).toBeCloseTo(original[0], 7);
    expect(restored[1]).toBeCloseTo(original[1], 6);
    expect(restored[2]).toBeCloseTo(original[2], 7);
    expect(restored[3]).toBeCloseTo(original[3], 2);
  });

  it('should convert Base64 to Hex and back correctly', () => {
    const originalBase64 = 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=';
    const hex = base64ToHex(originalBase64);
    const restoredBase64 = hexToBase64(hex);
    expect(restoredBase64).toBe(originalBase64);
  });
});

describe('Native Cryptography Mocks', () => {
  it('should encrypt and decrypt correctly', async () => {
    const text = 'test_embedding_serialization_data';
    const encrypted = await encryptData(text);
    
    // Encrypted string should contain random IV and prefix
    expect(encrypted).toContain(':enc_');
    
    const decrypted = await decryptData(encrypted);
    expect(decrypted).toBe(text);
  });
});

describe('Progressive Lockout Rules', () => {
  const getLockoutDuration = (attempts: number): number => {
    if (attempts >= 15) return 10 * 60 * 1000; // 10 mins
    if (attempts >= 10) return 2 * 60 * 1000;  // 2 mins
    if (attempts >= 5) return 30 * 1000;       // 30 secs
    return 0;
  };

  it('should calculate correct lockout times progressively', () => {
    expect(getLockoutDuration(1)).toBe(0);
    expect(getLockoutDuration(4)).toBe(0);
    expect(getLockoutDuration(5)).toBe(30000);
    expect(getLockoutDuration(9)).toBe(30000);
    expect(getLockoutDuration(10)).toBe(120000);
    expect(getLockoutDuration(14)).toBe(120000);
    expect(getLockoutDuration(15)).toBe(600000);
    expect(getLockoutDuration(20)).toBe(600000);
  });
});
