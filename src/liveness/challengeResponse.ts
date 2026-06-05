/**
 * Challenge-Response Module
 * Manages a randomized 3-step liveness challenge state machine.
 * Challenges include: BLINK, HEAD_LEFT, HEAD_RIGHT, SMILE, LOOK_UP, LOOK_DOWN
 * Challenges are randomized to prevent replay scripting attacks.
 */

export type ChallengeType = 'BLINK' | 'HEAD_LEFT' | 'HEAD_RIGHT' | 'SMILE' | 'LOOK_UP' | 'LOOK_DOWN';

export type ChallengeStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'EXPIRED';

export interface ChallengeStep {
  type: ChallengeType;
  status: ChallengeStatus;
  startTimeMs: number;
  completedTimeMs?: number;
}

export interface ChallengeSession {
  steps: ChallengeStep[];
  currentIndex: number;
  sessionId: string;
  sessionStartMs: number;
  allPassed: boolean;
  failed: boolean;
}

// Step timeout: each step must be completed within this window
const STEP_TIMEOUT_MS = 6000;

// Total session timeout: all steps must complete within this
const SESSION_TIMEOUT_MS = 25000;

// Available challenge pool (randomized for each session)
const CHALLENGE_POOL: ChallengeType[] = [
  'BLINK',
  'HEAD_LEFT',
  'HEAD_RIGHT',
  'LOOK_UP',
  'LOOK_DOWN',
];

// --- Module-level session state ---
let currentSession: ChallengeSession | null = null;

/**
 * Generates a simple unique session ID string (no crypto dependency).
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.floor(Math.random() * 99999)}`;
}

/**
 * Shuffles an array in-place using Fisher-Yates algorithm.
 */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Starts a new randomized challenge session with `count` steps.
 * Replaces any existing session.
 */
export function startChallengeSession(count: number = 3): ChallengeSession {
  const shuffled = shuffleArray(CHALLENGE_POOL);
  const selected = shuffled.slice(0, Math.min(count, CHALLENGE_POOL.length));

  const now = Date.now();
  const steps: ChallengeStep[] = selected.map(type => ({
    type,
    status: 'PENDING',
    startTimeMs: now,
  }));

  // Stagger step start times — each step starts when the previous one would be accepted
  // We'll set the first step start time now; subsequent steps get their start time on completion.
  if (steps.length > 0) {
    steps[0].startTimeMs = now;
  }

  currentSession = {
    steps,
    currentIndex: 0,
    sessionId: generateSessionId(),
    sessionStartMs: now,
    allPassed: false,
    failed: false,
  };

  console.log(`[ChallengeResponse] Session started: ${currentSession.sessionId}`);
  console.log(`[ChallengeResponse] Steps: ${steps.map(s => s.type).join(' -> ')}`);

  return currentSession;
}

/**
 * Returns the current active session, or null if none exists.
 */
export function getCurrentChallengeSession(): ChallengeSession | null {
  return currentSession;
}

/**
 * Returns the currently active (PENDING) challenge step, or null if done.
 */
export function getCurrentChallenge(): ChallengeStep | null {
  if (currentSession == null || currentSession.allPassed || currentSession.failed) {
    return null;
  }
  const step = currentSession.steps[currentSession.currentIndex];
  if (!step || step.status !== 'PENDING') return null;
  return step;
}

/**
 * Reports the result of a challenge attempt. Should be called from the JS thread.
 * @param passed - Whether the current step was successfully completed.
 */
export function reportChallengeResult(passed: boolean): ChallengeSession {
  if (currentSession == null) {
    console.warn('[ChallengeResponse] reportChallengeResult called without active session');
    return createEmptySession();
  }

  const now = Date.now();

  // Session expiry check
  if (now - currentSession.sessionStartMs > SESSION_TIMEOUT_MS) {
    console.log('[ChallengeResponse] SESSION_EXPIRED — Total time exceeded');
    currentSession.failed = true;
    currentSession.steps[currentSession.currentIndex].status = 'EXPIRED';
    return currentSession;
  }

  const step = currentSession.steps[currentSession.currentIndex];

  // Step expiry check
  if (now - step.startTimeMs > STEP_TIMEOUT_MS) {
    console.log(`[ChallengeResponse] STEP_EXPIRED: ${step.type}`);
    step.status = 'EXPIRED';
    currentSession.failed = true;
    return currentSession;
  }

  if (passed) {
    step.status = 'PASSED';
    step.completedTimeMs = now;
    console.log(`[ChallengeResponse] STEP_PASSED: ${step.type}`);

    currentSession.currentIndex++;

    if (currentSession.currentIndex >= currentSession.steps.length) {
      // All steps completed
      currentSession.allPassed = true;
      console.log(`[ChallengeResponse] ALL_CHALLENGES_PASSED — Session: ${currentSession.sessionId}`);
      console.log('[QA] CHALLENGE_RESPONSE_PASSED');
    } else {
      // Activate next step
      currentSession.steps[currentSession.currentIndex].startTimeMs = now;
      console.log(`[ChallengeResponse] NEXT_CHALLENGE: ${currentSession.steps[currentSession.currentIndex].type}`);
    }
  } else {
    // Failed attempt — mark failed
    step.status = 'FAILED';
    currentSession.failed = true;
    console.log(`[ChallengeResponse] STEP_FAILED: ${step.type}`);
  }

  return currentSession;
}

/**
 * Resets and clears the current session.
 */
export function resetChallengeSession(): void {
  if (currentSession != null) {
    console.log(`[ChallengeResponse] Session reset: ${currentSession.sessionId}`);
  }
  currentSession = null;
}

/**
 * Returns a display instruction for the current challenge.
 */
export function getChallengeInstruction(): string {
  const step = getCurrentChallenge();
  if (step == null) {
    if (currentSession?.allPassed) return 'Liveness verified ✓';
    if (currentSession?.failed) return 'Challenge failed. Please restart.';
    return 'Ready';
  }

  switch (step.type) {
    case 'BLINK':     return 'Please blink';
    case 'HEAD_LEFT': return 'Turn head LEFT';
    case 'HEAD_RIGHT':return 'Turn head RIGHT';
    case 'SMILE':     return 'Please smile';
    case 'LOOK_UP':   return 'Look UP';
    case 'LOOK_DOWN': return 'Look DOWN';
    default:          return 'Follow the instruction';
  }
}

/**
 * Returns overall session progress [0..1].
 */
export function getChallengeProgress(): number {
  if (currentSession == null) return 0;
  const passed = currentSession.steps.filter(s => s.status === 'PASSED').length;
  return passed / currentSession.steps.length;
}

// --------------- Internal Helpers ---------------

function createEmptySession(): ChallengeSession {
  return {
    steps: [],
    currentIndex: 0,
    sessionId: '',
    sessionStartMs: 0,
    allPassed: false,
    failed: true,
  };
}
