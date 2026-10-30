import type React from "react";
import { passInfo, daysAgoText, inDaysText, shortDate } from "../lib/satellite";
import { SatelliteIcon } from "./icons";

function status(daysSince: number | null) {
  if (daysSince === null) return { label: "No image yet", cls: "bg-parchment dark:bg-night-950 text-ink/70 dark:text-parchment/70" };
  if (daysSince <= 7) return { label: "Up to date", cls: "bg-growth-100 text-growth-700" };
  if (daysSince <= 14) return { label: "Waiting for a clear image", cls: "bg-sky-100 text-sky-700" };
  return { label: `No clear image for ${daysSince} days`, cls: "bg-laterite-100 text-laterite-700" };
}

/**
 * A slim strip for one field: its last usable image and the next expected
 * pass. ("Last" means the last image clear enough to use, because cloudy
 * passes are skipped.) Home shows the same facts as a stat card instead.
 */
export default function SatellitePasses({
  lastDates,
  action,
}: {
  lastDates: (string | null | undefined)[];
  /** Optional control shown at the end of the strip (e.g. a refresh button). */
  action?: React.ReactNode;
}) {
  const info = passInfo(lastDates);
  const st = status(info.daysSinceLast);

  const last = info.hasImage
    ? { big: daysAgoText(info.daysSinceLast as number), small: shortDate(info.lastDate as Date) }
    : { big: "No image yet", small: "Waiting for a clear image" };
  const next = info.hasImage
    ? { big: inDaysText(info.daysUntilNext as number), small: shortDate(info.nextDate as Date) }
    : { big: "Every 2 to 5 days", small: "Exact date shows after the first image" };

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl bg-white dark:bg-night-900 p-4 shadow-sm shadow-canopy-900/5 dark:shadow-none">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
        <SatelliteIcon size={18} />
      </span>
      <div>
        <p className="text-xs text-ink/70 dark:text-parchment/70">Last usable image</p>
        <p className="text-sm font-bold text-ink dark:text-parchment">
          {last.big} <span className="font-normal text-ink/70 dark:text-parchment/70">· {last.small}</span>
        </p>
      </div>
      <div>
        <p className="text-xs text-ink/70 dark:text-parchment/70">Next pass expected</p>
        <p className="text-sm font-bold text-ink dark:text-parchment">
          {next.big} <span className="font-normal text-ink/70 dark:text-parchment/70">· {next.small}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 sm:ml-auto">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
        {action}
      </div>
    </div>
  );
}
