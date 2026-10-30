/**
 * Sentinel-2 flies as two satellites 180 degrees apart in the same orbit.
 * Each one repeats its path every 10 days, so together they pass over the
 * same spot on the equator (where Uganda is) every 5 days. That regular
 * rhythm lets us estimate the next pass from any earlier one: count forward
 * in steps of 5 days from the last image we have.
 *
 * It is an estimate, not a schedule. An extra satellite can add a pass in
 * between, and cloudy images are skipped, so the real next USABLE image can
 * take longer.
 */
export const PASS_INTERVAL_DAYS = 5;

const DAY = 86400000;

/** Midnight (UTC) of a plain calendar day, so date maths ignores time zones. */
function dayNumber(y: number, m: number, d: number) {
  return Math.round(Date.UTC(y, m, d) / DAY);
}
function isoToDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return dayNumber(y, m - 1, d);
}
function todayDay(now: Date) {
  return dayNumber(now.getFullYear(), now.getMonth(), now.getDate());
}
function dayToDate(day: number) {
  const d = new Date(day * DAY);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export type PassInfo = {
  hasImage: boolean;
  lastDate: Date | null;
  daysSinceLast: number | null;
  nextDate: Date | null;
  daysUntilNext: number | null;
};

const NONE: PassInfo = { hasImage: false, lastDate: null, daysSinceLast: null, nextDate: null, daysUntilNext: null };

/** Last image and estimated next pass for one or more fields. With several
 *  fields, "last" is the newest image on any field and "next" is the
 *  soonest expected pass on any field (each field is counted from its own
 *  last image, because neighbouring areas can be on different orbits). */
export function passInfo(lastIsoDates: (string | null | undefined)[], now = new Date()): PassInfo {
  const dates = lastIsoDates.filter((d): d is string => !!d);
  if (dates.length === 0) return NONE;
  const today = todayDay(now);

  let newest = -Infinity;
  let soonest = Infinity;
  for (const iso of dates) {
    const last = isoToDay(iso);
    newest = Math.max(newest, last);
    const since = today - last;
    // If today lands exactly on the 5-day rhythm, a pass is due today.
    const steps = since <= 0 ? 1 : Math.ceil(since / PASS_INTERVAL_DAYS);
    soonest = Math.min(soonest, last + steps * PASS_INTERVAL_DAYS);
  }
  return {
    hasImage: true,
    lastDate: dayToDate(newest),
    daysSinceLast: today - newest,
    nextDate: dayToDate(soonest),
    daysUntilNext: soonest - today,
  };
}

/** Whole calendar days since a YYYY-MM-DD date (same counting as passInfo). */
export function daysSince(iso: string, now = new Date()) {
  return todayDay(now) - isoToDay(iso);
}

export function daysAgoText(n: number) {
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  return `${n} days ago`;
}
export function inDaysText(n: number) {
  if (n <= 0) return "today";
  if (n === 1) return "tomorrow";
  return `in ${n} days`;
}
export function shortDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
