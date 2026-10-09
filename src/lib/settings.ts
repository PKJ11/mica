/** Optional override from the environment, e.g. IDLE_LOGOUT_MS=20000 to test the timeout quickly. */
function ms(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/**
 * Tracking and session thresholds (LG-6, EV-5). Kept in one place so they can move to the
 * admin settings screen (AD-4) without touching the tracker or the session code.
 */
export const SETTINGS = {
  /** First, non-blocking "Still there?" bar. */
  idleWarnMs: ms("IDLE_WARN_MS", 5 * 60_000),
  /** Blocking dialog with a countdown. */
  idleFinalMs: ms("IDLE_FINAL_MS", 6 * 60_000),
  /** Signed out. */
  idleLogoutMs: ms("IDLE_LOGOUT_MS", 7 * 60_000),
  /** A heartbeat is sent this often while the tab is visible and recently used. */
  heartbeatMs: 15_000,
  /** "Recently used" for heartbeats: an input within this window. */
  activeWindowMs: 60_000,
  /** Extra slack the server allows past idleLogoutMs before it ends a session on its own. */
  serverGraceMs: ms("SERVER_GRACE_MS", 60_000),
};

/** Score bands (section 8): strong from 80 %, developing from 50 %, no band on fewer than 3 questions. */
export const BANDS = {
  strongFrom: 80,
  developingFrom: 50,
  minQuestions: 3,
};

/** Bump when the "What we record" text changes; everyone is asked to agree again (S2). */
export const NOTICE_VERSION = "2026-10-v1";
