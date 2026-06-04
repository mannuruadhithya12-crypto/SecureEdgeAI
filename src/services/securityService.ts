import {
  isRooted,
  isDebuggerPresent,
  checkApkIntegrity,
  getSecurityReport,
  getFridaReport,
  getMagiskReport,
  getHookReport,
} from '../security/deviceHardening';
import { logSecurityEvent } from '../security/auditLogger';
import { getSecurityAnalytics, type SecurityAnalytics } from '../security/securityDashboard';

export {
  isRooted,
  isDebuggerPresent,
  checkApkIntegrity,
  getSecurityReport,
  getFridaReport,
  getMagiskReport,
  getHookReport,
  logSecurityEvent,
  getSecurityAnalytics,
};

export type { SecurityAnalytics };

export type SecurityTelemetryReport = {
  isRooted: boolean;
  isDebuggerAttached: boolean;
  isApkVerified: boolean;
  fridaDetected: boolean;
  magiskDetected: boolean;
  hooksDetected: boolean;
};

export async function runSecurityTelemetrySweep(): Promise<SecurityTelemetryReport> {
  const root = await isRooted();
  const debug = await isDebuggerPresent();
  const apk = await checkApkIntegrity();
  
  const fridaRep = await getFridaReport();
  const magiskRep = await getMagiskReport();
  const hookRep = await getHookReport();

  return {
    isRooted: root,
    isDebuggerAttached: debug,
    isApkVerified: apk,
    fridaDetected: fridaRep.fridaDetected,
    magiskDetected: magiskRep.magiskDetected,
    hooksDetected: hookRep.runtimeHooksDetected || hookRep.xposedDetected || hookRep.lsposedDetected,
  };
}
