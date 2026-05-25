import { NativeModules, Platform } from 'react-native';

const { SecurityModule } = NativeModules;

export async function isRooted(): Promise<boolean> {
  if (__DEV__) {
    console.log('[Hardening] Bypassing Root Detection check in DEV mode');
    return false;
  }
  if (Platform.OS !== 'android') return false;
  try {
    return await SecurityModule.isDeviceRooted();
  } catch (error) {
    console.warn('[Hardening] Native Root Detection check error:', error);
    return false;
  }
}

export async function isDebuggerPresent(): Promise<boolean> {
  if (__DEV__) {
    console.log('[Hardening] Bypassing Debugger Detection check in DEV mode');
    return false;
  }
  if (Platform.OS !== 'android') return false;
  try {
    return await SecurityModule.isDebuggerAttached();
  } catch (error) {
    console.warn('[Hardening] Native Debugger Detection check error:', error);
    return false;
  }
}

export async function checkApkIntegrity(): Promise<boolean> {
  if (__DEV__) {
    console.log('[Hardening] Bypassing APK Integrity check in DEV mode');
    return true;
  }
  if (Platform.OS !== 'android') return true;
  try {
    const signatureHash = await SecurityModule.checkApkSignature();
    console.log(`[Hardening] APK SHA-256 Signature: ${signatureHash}`);
    return signatureHash != null && signatureHash.length > 0;
  } catch (error) {
    console.warn('[Hardening] Native APK Integrity check error:', error);
    return false;
  }
}
