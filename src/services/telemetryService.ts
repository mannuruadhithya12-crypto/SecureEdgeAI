import { getProcessTelemetry } from '../security/deviceHardening';

export { getProcessTelemetry };

export type TelemetryStats = {
  fps: number;
  inferenceMs: number;
  memoryMb: number;
};

export async function fetchSystemTelemetry(
  fps: number,
  inferenceMs: number,
  fallbackUserCount: number
): Promise<TelemetryStats> {
  let memoryMb = 0;
  try {
    const stats = await getProcessTelemetry();
    memoryMb = stats.usedMemoryMb;
  } catch {
    // Fallback simulation in DEV/Emulator
    const now = Date.now();
    const memoryUsed = 92.4 + (fallbackUserCount * 0.12) + (Math.sin(now / 10000) * 0.5);
    memoryMb = Math.round(memoryUsed * 10) / 10;
  }

  return {
    fps,
    inferenceMs,
    memoryMb,
  };
}
