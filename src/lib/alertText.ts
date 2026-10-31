/** Shared words and styles for alerts, so every screen describes them the same way. */

export const CAUSE_LABEL: Record<string, string> = {
  drought: "Drought",
  excess_rainfall: "Too much water",
  pest_disease: "Pest or disease",
  natural_senescence: "Natural ripening",
};

export function causeText(cause: string | null, confidence: number | null): string | null {
  if (!cause) return null;
  const label = CAUSE_LABEL[cause] ?? cause.split("_").join(" ");
  return confidence == null ? `Likely cause: ${label}` : `Likely cause: ${label}, ${Math.round(confidence)}% sure`;
}

export const SEVERITY_LABEL: Record<string, string> = { low: "Low", moderate: "Moderate", high: "High" };

/** Severity chip colours. Light tints become a soft wash in dark mode (index.css). */
export const SEVERITY_STYLE: Record<string, string> = {
  low: "bg-sky-100 text-sky-700",
  moderate: "bg-laterite-100 text-laterite-700",
  high: "bg-laterite-700 text-white",
};

/** A small round marker in the severity colour, for compact lists. */
export const SEVERITY_DOT: Record<string, string> = {
  low: "bg-sky-600",
  moderate: "bg-laterite-600",
  high: "bg-laterite-700",
};

/** Shown wherever a date is missing or cannot be read, instead of "Invalid Date". */
export const UNKNOWN_DATE = "Date unknown";

export function formatAlertDate(iso: string | null | undefined) {
  if (!iso) return UNKNOWN_DATE;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return UNKNOWN_DATE;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then a date. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(t)) return UNKNOWN_DATE;
  const diff = Math.max(0, now - t);
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
