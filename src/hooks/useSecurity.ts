import { useState, useEffect } from 'react';
import { runSecurityTelemetrySweep } from '../services/securityService';

export function useSecurity(isEnabled: boolean = true) {
  const [hardeningRoot, setHardeningRoot] = useState(false);
  const [hardeningDebugger, setHardeningDebugger] = useState(false);
  const [hardeningIntegrity, setHardeningIntegrity] = useState(true);

  useEffect(() => {
    if (!isEnabled) return;

    const runChecks = async () => {
      try {
        const sweep = await runSecurityTelemetrySweep();
        setHardeningRoot(sweep.isRooted);
        setHardeningDebugger(sweep.isDebuggerAttached);
        setHardeningIntegrity(sweep.isApkVerified);
      } catch (err) {
        console.warn('[useSecurity] Telemetry sweep failed:', err);
      }
    };

    runChecks();
    const interval = setInterval(runChecks, 5000);
    return () => clearInterval(interval);
  }, [isEnabled]);

  return {
    hardeningRoot,
    hardeningDebugger,
    hardeningIntegrity,
  };
}
