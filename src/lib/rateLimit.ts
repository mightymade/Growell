/**
 * Client-side rate limiting. This is a UX layer that slows down accidental
 * spam (double-clicks, retry loops, someone guessing passwords by hand) —
 * it is NOT a security boundary. Anyone can bypass it by clearing site data
 * or opening a private window, so it must never be the only thing standing
 * between an attacker and an endpoint. The real protection for sign-in,
 * sign-up and password reset is Supabase Auth's own server-side rate
 * limiting, which is enforced regardless of what this file does. This layer
 * exists on top of that for a better experience, and to add basic friction
 * to a couple of writes (alert feedback, avatar upload) that Supabase Auth's
 * limits don't cover.
 */

type Attempt = { t: number };

function readAttempts(key: string): Attempt[] {
  try {
    const raw = localStorage.getItem(`growell_rl_${key}`);
    return raw ? (JSON.parse(raw) as Attempt[]) : [];
  } catch {
    return [];
  }
}

function writeAttempts(key: string, attempts: Attempt[]) {
  try {
    localStorage.setItem(`growell_rl_${key}`, JSON.stringify(attempts));
  } catch {
    // Storage unavailable (private mode, quota) — fail open rather than block the user.
  }
}

/** Records one attempt now, and returns how many attempts fall inside the
 *  trailing window (including this one). */
export function recordAttempt(key: string, windowMs: number): number {
  const cutoff = Date.now() - windowMs;
  const kept = readAttempts(key).filter((a) => a.t > cutoff);
  kept.push({ t: Date.now() });
  writeAttempts(key, kept);
  return kept.length;
}

/** How many attempts fall inside the trailing window, without recording a new one. */
export function attemptsInWindow(key: string, windowMs: number): number {
  const cutoff = Date.now() - windowMs;
  return readAttempts(key).filter((a) => a.t > cutoff).length;
}

export function clearAttempts(key: string) {
  try {
    localStorage.removeItem(`growell_rl_${key}`);
  } catch {
    // ignore
  }
}

/** A simple cooldown: true once, then blocked until `ms` has passed. Good
 *  for a single button like "resend reset email". */
export function checkAndStartCooldown(key: string, ms: number): { allowed: boolean; retryInSeconds: number } {
  const raw = (() => {
    try {
      return localStorage.getItem(`growell_cd_${key}`);
    } catch {
      return null;
    }
  })();
  const until = raw ? Number(raw) : 0;
  const now = Date.now();
  if (until > now) return { allowed: false, retryInSeconds: Math.ceil((until - now) / 1000) };
  try {
    localStorage.setItem(`growell_cd_${key}`, String(now + ms));
  } catch {
    // ignore
  }
  return { allowed: true, retryInSeconds: 0 };
}

// ---- Login lockout: escalating cooldown after repeated failures on one
// email, reset on a successful sign-in. Independent of Supabase's own
// server-side limiting — see the file note above.
const LOCKOUT_STEPS: Array<{ afterFailures: number; lockMs: number }> = [
  { afterFailures: 3, lockMs: 30 * 1000 },
  { afterFailures: 5, lockMs: 2 * 60 * 1000 },
  { afterFailures: 8, lockMs: 10 * 60 * 1000 },
];

function loginKey(email: string) {
  return `login_${email.trim().toLowerCase()}`;
}

export function checkLoginLockout(email: string): { locked: boolean; retryInSeconds: number } {
  const key = loginKey(email);
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(`growell_lock_${key}`);
  } catch {
    return { locked: false, retryInSeconds: 0 };
  }
  if (!raw) return { locked: false, retryInSeconds: 0 };
  const until = Number(raw);
  const now = Date.now();
  if (until <= now) return { locked: false, retryInSeconds: 0 };
  return { locked: true, retryInSeconds: Math.ceil((until - now) / 1000) };
}

export function recordLoginFailure(email: string) {
  const key = loginKey(email);
  const failures = recordAttempt(key, 30 * 60 * 1000); // failures counted over a 30-minute window
  const step = [...LOCKOUT_STEPS].reverse().find((s) => failures >= s.afterFailures);
  if (step) {
    try {
      localStorage.setItem(`growell_lock_${key}`, String(Date.now() + step.lockMs));
    } catch {
      // ignore
    }
  }
}

export function recordLoginSuccess(email: string) {
  const key = loginKey(email);
  clearAttempts(key);
  try {
    localStorage.removeItem(`growell_lock_${key}`);
  } catch {
    // ignore
  }
}
