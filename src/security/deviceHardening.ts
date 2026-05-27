import { NativeModules, Platform } from 'react-native';

export async function isRooted(): Promise<boolean> {
  if (__DEV__) {
    console.log('[Hardening] Bypassing Root Detection check in DEV mode');
    return false;
  }
  if (Platform.OS !== 'android') return false;
  try {
    return (await NativeModules.SecurityModule?.isDeviceRooted?.()) ?? false;
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
    return (await NativeModules.SecurityModule?.isDebuggerAttached?.()) ?? false;
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
    const signatureHash = await NativeModules.SecurityModule?.checkApkSignature?.();
    console.log(`[Hardening] APK SHA-256 Signature: ${signatureHash}`);
    return signatureHash != null && signatureHash.length > 0;
  } catch (error) {
    console.warn('[Hardening] Native APK Integrity check error:', error);
    return false;
  }
}

export interface TelemetryData {
  usedMemoryMb: number;
  thermalStatus: string;
}

export async function getProcessTelemetry(): Promise<TelemetryData> {
  if (Platform.OS !== 'android') {
    return { usedMemoryMb: 92.4, thermalStatus: 'NONE' };
  }
  try {
    const result = await NativeModules.SecurityModule?.getProcessMemoryAndThermal?.();
    if (result) {
      return result;
    }
    return { usedMemoryMb: 92.4, thermalStatus: 'NONE' };
  } catch (error) {
    console.warn('[Hardening] Failed to get native telemetry:', error);
    return { usedMemoryMb: 0, thermalStatus: 'UNKNOWN' };
  }
}

function withTimeout<T>(promise: Promise<T> | undefined, timeoutMs: number, defaultValue: T): Promise<T> {
  if (!promise) return Promise.resolve(defaultValue);
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`[Hardening] Native security scan timed out after ${timeoutMs}ms`);
      resolve(defaultValue);
    }, timeoutMs);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        console.warn('[Hardening] Security scan failed:', err);
        resolve(defaultValue);
      });
  });
}

export interface SecurityReport {
  rooted: boolean;
  debugger: boolean;
  fridaDetected: boolean;
  xposedDetected: boolean;
  suspiciousProcesses: string[];
}

export async function getSecurityReport(): Promise<SecurityReport> {
  const fallback: SecurityReport = {
    rooted: false,
    debugger: false,
    fridaDetected: false,
    xposedDetected: false,
    suspiciousProcesses: [],
  };
  if (__DEV__ || Platform.OS !== 'android') return fallback;
  try {
    const p = NativeModules.SecurityModule?.getSecurityReport?.();
    return await withTimeout(p, 5000, fallback);
  } catch (error) {
    console.warn('[Hardening] Failed to get native security report:', error);
    return fallback;
  }
}

export interface FridaReport {
  fridaDetected: boolean;
  fridaPortsDetected: boolean;
  fridaLibrariesDetected: boolean;
  suspiciousProcesses: string[];
}

export async function getFridaReport(): Promise<FridaReport> {
  const fallback: FridaReport = {
    fridaDetected: false,
    fridaPortsDetected: false,
    fridaLibrariesDetected: false,
    suspiciousProcesses: [],
  };
  if (__DEV__ || Platform.OS !== 'android') return fallback;
  try {
    const p = NativeModules.SecurityModule?.getFridaReport?.();
    return await withTimeout(p, 5000, fallback);
  } catch (error) {
    console.warn('[Hardening] Frida report failed:', error);
    return fallback;
  }
}

export interface MagiskReport {
  magiskDetected: boolean;
  zygiskDetected: boolean;
  suspiciousPaths: string[];
  suspiciousMounts: string[];
}

export async function getMagiskReport(): Promise<MagiskReport> {
  const fallback: MagiskReport = {
    magiskDetected: false,
    zygiskDetected: false,
    suspiciousPaths: [],
    suspiciousMounts: [],
  };
  if (__DEV__ || Platform.OS !== 'android') return fallback;
  try {
    const p = NativeModules.SecurityModule?.getMagiskReport?.();
    return await withTimeout(p, 5000, fallback);
  } catch (error) {
    console.warn('[Hardening] Magisk report failed:', error);
    return fallback;
  }
}

export interface HookReport {
  xposedDetected: boolean;
  lsposedDetected: boolean;
  runtimeHooksDetected: boolean;
}

export async function getHookReport(): Promise<HookReport> {
  const fallback: HookReport = {
    xposedDetected: false,
    lsposedDetected: false,
    runtimeHooksDetected: false,
  };
  if (__DEV__ || Platform.OS !== 'android') return fallback;
  try {
    const p = NativeModules.SecurityModule?.getHookReport?.();
    return await withTimeout(p, 5000, fallback);
  } catch (error) {
    console.warn('[Hardening] Hook report failed:', error);
    return fallback;
  }
}
