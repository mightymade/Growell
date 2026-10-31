// Small formatting helpers shared by every admin page.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "3 hours ago", "Yesterday", "4 days ago", "12 Oct", "12 Oct 2025". */
export function relativeTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "Never";
  const t = new Date(iso);
  const diff = now.getTime() - t.getTime();
  if (diff < MIN) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min ago`;
  if (diff < DAY && t.getDate() === now.getDate()) {
    const h = Math.floor(diff / HOUR);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const days = calendarDaysBetween(t, now);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return shortDate(iso, t.getFullYear() !== now.getFullYear());
}

/** Whole calendar days between two moments, in local time. */
export function calendarDaysBetween(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((db - da) / DAY);
}

/** "12 Oct" or "12 Oct 2025". Date-only strings are read as local dates. */
export function shortDate(iso: string | null | undefined, withYear = false): string {
  if (!iso) return "None";
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

/** "12 Oct 2026" */
export function fullDate(iso: string | null | undefined): string {
  return shortDate(iso, true);
}

/** "Sat 31 Oct 2026, 14:05:09", for tooltips and the event detail panel. */
export function exactTime(iso: string | null | undefined, seconds = false): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
  });
}

/** "14:05" */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Day heading for grouped lists: "Today", "Yesterday", "Mon 26 Oct". */
export function dayHeading(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const days = calendarDaysBetween(d, now);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Local calendar day key, used to group events. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function hectares(v: number | null | undefined): string {
  if (v === null || v === undefined) return "None";
  return `${Number(v).toLocaleString("en-GB", { maximumFractionDigits: 2, minimumFractionDigits: v >= 100 ? 0 : 2 })} ha`;
}

export function count(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-GB");
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function durationText(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "Unknown";
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${s % 60} s`;
}

/** Builds a CSV file and makes the browser save it. */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Quote everything that needs it, and defuse spreadsheet formulas.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
