import { passInfo, inDaysText, shortDate } from "../lib/satellite";
import { SatelliteIcon } from "./icons";

/**
 * The fourth card in Home's top row: when the satellite is next expected
 * over the farmer's fields. Same look as the other stat cards; the exact
 * date is in the tooltip.
 */
export default function SatelliteStatCard({ lastDates }: { lastDates: (string | null | undefined)[] }) {
  const info = passInfo(lastDates);
  const has = info.hasImage;

  const when = has ? inDaysText(info.daysUntilNext as number) : "Not known yet";
  const value = when.charAt(0).toUpperCase() + when.slice(1);
  const title = has
    ? `Next pass expected around ${shortDate(info.nextDate as Date)}. Cloudy passes are skipped, so a new reading can take longer.`
    : "The next pass can be worked out once the first clear satellite image arrives.";

  return (
    <div title={title} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-e1 dark:bg-night-900">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700" aria-hidden>
        <SatelliteIcon size={18} />
      </span>
      <div className="min-w-0">
        <p className={`font-display text-xl font-semibold leading-tight ${has ? "text-ink dark:text-parchment" : "text-ink/70 dark:text-parchment/70"}`}>
          {value}
        </p>
        <p className="mt-1 text-sm leading-tight text-ink/70 dark:text-parchment/70">Next satellite pass</p>
      </div>
    </div>
  );
}
