import { useState, useEffect, useRef } from 'react';
import { getSecuredData, saveSecuredData } from '../security/secureStorage';

type AuthState = 'IDLE' | 'SCANNING' | 'DETECTING' | 'VERIFYING' | 'AUTHENTICATED' | 'REJECTED';

export function useFaceAuth(activeUser: { name: string } | null, statusUpdater: (s: string) => void) {
  const [authState, setAuthState] = useState<AuthState>('IDLE');
  const [authScore, setAuthScore] = useState(0);
  const [authenticatedUser, setAuthenticatedUser] = useState<string | null>(null);
  const [rollingScores, setRollingScores] = useState<number[]>([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState<{ [username: string]: number }>({});
  const [lockoutExpiry, setLockoutExpiry] = useState<{ [username: string]: number }>({});
  
  const lastFailureIncrementRef = useRef<number>(0);
  const lastAuthTimeRef = useRef<number>(0);
  const lastRejectionTimeRef = useRef<number>(0);
  const sessionExpiryRef = useRef<number>(0);

  // Lockout countdown timer loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeUser == null) return;
      const expiry = lockoutExpiry[activeUser.name] || 0;
      const diff = expiry - Date.now();
      if (diff > 0) {
        setLockoutTimeLeft(Math.ceil(diff / 1000));
      } else {
        setLockoutTimeLeft(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeUser, lockoutExpiry]);

  // Session expiry tracker loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionActive) {
        const now = Date.now();
        if (now >= sessionExpiryRef.current) {
          setSessionActive(false);
          setAuthState('IDLE');
          setAuthenticatedUser(null);
          statusUpdater('Session expired. Align face to re-authenticate.');
        } else {
          const secondsLeft = Math.ceil((sessionExpiryRef.current - now) / 1000);
          statusUpdater(`Session Active (${secondsLeft}s left): ${activeUser?.name}`);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionActive, activeUser]);

  const loadLockouts = async () => {
    if (!activeUser) return;
    try {
      const attempts = await getSecuredData(`failed_attempts_${activeUser.name}`);
      const expiry = await getSecuredData(`lockout_expiry_${activeUser.name}`);
      
      if (attempts) {
        setFailedAttempts(prev => ({ ...prev, [activeUser.name]: parseInt(attempts, 10) }));
      }
      if (expiry) {
        setLockoutExpiry(prev => ({ ...prev, [activeUser.name]: parseInt(expiry, 10) }));
      }
    } catch (e) {
      console.warn('[useFaceAuth] Load lockouts failed:', e);
    }
  };

  useEffect(() => {
    loadLockouts();
  }, [activeUser]);

  const startScanning = () => {
    setAuthState('SCANNING');
    setRollingScores([]);
  };

  const handleVerificationSuccess = async (bestScore: number) => {
    if (!activeUser) return;
    lastAuthTimeRef.current = Date.now();
    sessionExpiryRef.current = Date.now() + 30000;
    setSessionActive(true);
    setAuthState('AUTHENTICATED');
    setAuthenticatedUser(activeUser.name);
    setAuthScore(bestScore);

    console.log(`[QA] ACTIVE_PROFILE_UPDATED ${activeUser.name}`);

    await saveSecuredData(`failed_attempts_${activeUser.name}`, '0');
    setFailedAttempts(prev => ({ ...prev, [activeUser.name]: 0 }));

    const nowStr = new Date().toLocaleString();
    const cStr = await getSecuredData(`auth_count_${activeUser.name}`);
    const newCount = (cStr ? parseInt(cStr, 10) : 0) + 1;
    await saveSecuredData(`auth_count_${activeUser.name}`, String(newCount));
    await saveSecuredData(`last_active_${activeUser.name}`, nowStr);
  };

  const handleVerificationFailure = async (bestScore: number) => {
    if (!activeUser) return;
    setAuthenticatedUser(null);
    setAuthScore(bestScore);

    const now = Date.now();
    if (now - lastFailureIncrementRef.current > 3000) {
      lastFailureIncrementRef.current = now;
      const currentAttempts = (failedAttempts[activeUser.name] || 0) + 1;
      
      await saveSecuredData(`failed_attempts_${activeUser.name}`, String(currentAttempts));
      setFailedAttempts(prev => ({ ...prev, [activeUser.name]: currentAttempts }));
      
      let lockoutTime = 0;
      if (currentAttempts >= 15) {
        lockoutTime = now + 10 * 60 * 1000;
      } else if (currentAttempts >= 10) {
        lockoutTime = now + 2 * 60 * 1000;
      } else if (currentAttempts >= 5) {
        lockoutTime = now + 30 * 1000;
      }

      if (lockoutTime > 0) {
        await saveSecuredData(`lockout_expiry_${activeUser.name}`, String(lockoutTime));
        setLockoutExpiry(prev => ({ ...prev, [activeUser.name]: lockoutTime }));
      }
    }
  };

  return {
    authState,
    setAuthState,
    authScore,
    setAuthScore,
    authenticatedUser,
    setAuthenticatedUser,
    rollingScores,
    setRollingScores,
    sessionActive,
    setSessionActive,
    lockoutTimeLeft,
    failedAttempts,
    setFailedAttempts,
    lockoutExpiry,
    setLockoutExpiry,
    startScanning,
    handleVerificationSuccess,
    handleVerificationFailure,
    lastAuthTimeRef,
    lastRejectionTimeRef,
  };
}
export type { AuthState };
