import { supabase } from "./supabase";
import { refreshFieldData } from "./backfill";

/**
 * Each field is checked for new satellite images once per login, the
 * first time it is opened. A login is told apart by the time the farmer
 * signed in, so refreshing the page does not check again, but logging
 * out and back in does.
 *
 * A field only counts as checked once a check actually worked. If the
 * network or the satellite service fails, it is tried again (three
 * attempts), and if those fail too, again the next time the field is
 * opened or the connection comes back. Cloudy passes are not failures:
 * the check worked, there was just nothing clear to save.
 *
 * This is a top-up. The daily server job checks every field every day
 * whether anyone logs in or not.
 */
const KEY = "growell_auto_checked";
// Sentinel-2 passes every 2 to 5 days, so a newer photo is not possible sooner.
export const AUTO_CHECK_MIN_AGE_DAYS = 2;
const RETRY_WAITS_MS = [5_000, 15_000];

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

async function loginStamp(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  return user ? `${user.id}:${user.last_sign_in_at ?? ""}` : null;
}

// Fields with a check running right now, so two views never start two.
const running = new Set<string>();

/** True if this field has not had a working check since this login. */
export async function needsAutoCheck(fieldId: string): Promise<boolean> {
  if (running.has(fieldId)) return false;
  const stamp = await loginStamp();
  return !!stamp && !read().includes(`${stamp}:${fieldId}`);
}

async function markChecked(fieldId: string) {
  const stamp = await loginStamp();
  if (!stamp) return;
  // Keep only this login's entries, so the list never grows.
  const done = read().filter((k) => k.startsWith(`${stamp}:`));
  try {
    localStorage.setItem(KEY, JSON.stringify([...done, `${stamp}:${fieldId}`]));
  } catch {
    /* storage blocked: it may simply check again next visit */
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs the check, retrying on failure. Resolves true when a check worked
 * (whether or not it found new images), false when every attempt failed.
 */
export async function runAutoCheck(fieldId: string): Promise<boolean> {
  if (running.has(fieldId)) return false;
  running.add(fieldId);
  try {
    for (let attempt = 0; attempt <= RETRY_WAITS_MS.length; attempt++) {
      if (attempt > 0) await wait(RETRY_WAITS_MS[attempt - 1]);
      if (!navigator.onLine) return false;
      const outcome = await refreshFieldData(fieldId);
      if (!outcome.failed) {
        await markChecked(fieldId);
        return true;
      }
      console.warn(`Image check attempt ${attempt + 1} failed for ${fieldId}: ${outcome.message}`);
    }
    return false;
  } finally {
    running.delete(fieldId);
  }
}
