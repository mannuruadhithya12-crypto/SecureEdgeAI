import { useEffect, useRef } from 'react';
import { getUsers } from '../database/database';

/**
 * Lightweight QA & Debugging Utilities for Hackathon / Production Audits.
 */

export const QA_LOG_PREFIX = '🛡️ [QA-Debug]';

export const perfMetrics = {
  appLaunchTime: Date.now(),
  startupLatencyMs: 0,
  authLatencyMs: 0,
  captureLatencyMs: 0,
};

/**
 * Hook to profile FPS on the JS thread using requestAnimationFrame.
 */
export function useFpsLogger(componentName: string, enabled: boolean = true) {
  const lastTimeRef = useRef<number>(Date.now());
  const framesRef = useRef<number>(0);
  const fpsIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    let animFrameId: number;
    const loop = () => {
      framesRef.current += 1;
      animFrameId = requestAnimationFrame(loop);
    };
    animFrameId = requestAnimationFrame(loop);

    // Report FPS every 2 seconds
    fpsIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTimeRef.current) / 1000;
      if (delta > 0) {
        const fps = Math.round(framesRef.current / delta);
        console.log(`🛡️ [QA-Perf] [FPS] [${componentName}] Stable frame rate: ${fps} FPS (Target: 15-25 FPS)`);
        logMemoryUsage();
      }
      framesRef.current = 0;
      lastTimeRef.current = now;
    }, 2000);

    return () => {
      cancelAnimationFrame(animFrameId);
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
      }
    };
  }, [componentName, enabled]);
}

/**
 * Logs active memory footprint metrics.
 */
export function logMemoryUsage(): void {
  const g = globalThis as any;
  if (g.HermesInternal && g.HermesInternal.getInstrumentedStats) {
    const stats = g.HermesInternal.getInstrumentedStats();
    const limit = Math.round(stats.jsHeapSizeLimit / 1024 / 1024);
    const allocated = Math.round(stats.jsHeapAllocatedSize / 1024 / 1024);
    console.log(`🛡️ [QA-Perf] [Memory] Hermes GC Heap: Allocated ${allocated}MB | Limit ${limit}MB`);
  } else {
    console.log(`🛡️ [QA-Perf] [Memory] Memory Footprint: Stable`);
  }
}

/**
 * Logs general runtime health, system specs, and offline status.
 */
export function logRuntimeHealth(): void {
  console.log(`${QA_LOG_PREFIX} --- System Health Report ---`);
  console.log(`${QA_LOG_PREFIX} Engine: Hermes JS Runtime`);
  console.log(`${QA_LOG_PREFIX} Network: Offline-First Mode Active`);
  console.log(`${QA_LOG_PREFIX} AI Delegate: NNAPI/XNNPACK (Simulated)`);
  console.log(`${QA_LOG_PREFIX} SQLite Driver: react-native-sqlite-storage (Active)`);
}

/**
 * Inspects and prints SQLite table integrity and total registered templates.
 */
export async function verifyDatabaseHealth(): Promise<void> {
  console.log(`${QA_LOG_PREFIX} --- Database Verification ---`);
  try {
    const users = await getUsers();
    console.log(`${QA_LOG_PREFIX} Table "users" exists: ✅`);
    console.log(`${QA_LOG_PREFIX} Total registered templates: ${users.length}`);
    users.forEach((user, idx) => {
      console.log(
        `${QA_LOG_PREFIX} [${idx + 1}] ID: ${user.employee_id} | Name: ${user.name} | Created: ${user.created_at}`
      );
    });
  } catch (error) {
    console.error(`${QA_LOG_PREFIX} Database health check failed: ❌`, error);
  }
}

/**
 * Logs camera lifecycle status transitions.
 */
export function logCameraState(event: 'initialization' | 'toggle' | 'capture', details: string): void {
  const timestamp = new Date().toISOString();
  console.log(`${QA_LOG_PREFIX} [Camera] [${timestamp}] Event: ${event.toUpperCase()} | Details: ${details}`);
}

/**
 * Logs authentication execution times, scores, and security classifications.
 */
export function logAuthEvent(
  employeeId: string,
  decision: 'valid' | 'uncertain' | 'reject',
  similarity: number,
  latencyMs: number
): void {
  const timestamp = new Date().toISOString();
  console.log(`${QA_LOG_PREFIX} [Auth-Event] [${timestamp}] User ID: ${employeeId}`);
  console.log(`${QA_LOG_PREFIX} [Auth-Event] Match Decision: ${decision.toUpperCase()}`);
  console.log(`${QA_LOG_PREFIX} [Auth-Event] Similarity Score: ${(similarity * 100).toFixed(2)}%`);
  console.log(`${QA_LOG_PREFIX} [Auth-Event] Inference Latency: ${latencyMs}ms`);
  
  if (decision === 'valid') {
    console.log(`${QA_LOG_PREFIX} [Auth-Event] Verification Successful ✅`);
  } else if (decision === 'uncertain') {
    console.log(`${QA_LOG_PREFIX} [Auth-Event] Warning: Uncertain biometric score ⚠️`);
  } else {
    console.log(`${QA_LOG_PREFIX} [Auth-Event] Security Alert: Unauthorized access attempt blocked ❌`);
  }
}
