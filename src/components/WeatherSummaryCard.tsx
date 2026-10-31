import type { WeatherSummary } from "../lib/types";

// Ten or more days in a row with under 1 mm of rain is worth watching.
const DRY_WATCH_DAYS = 10;

/** The latest day's weather for the field, and how long it has been dry, as a short list. */
export default function WeatherSummaryCard({
  weather,
  drySpellDays,
  className = "",
}: {
  weather: WeatherSummary | null;
  drySpellDays: number | null;
  className?: string;
}) {
  const num = (v: number | null | undefined, unit: string) => (v === null || v === undefined ? "No data" : `${v.toFixed(0)}${unit}`);
  const dryWatch = drySpellDays !== null && drySpellDays >= DRY_WATCH_DAYS;
  return (
    <div className={`rounded-xl bg-white p-4 shadow-e1 dark:bg-night-900 ${className}`}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink dark:text-parchment">Latest weather</p>
        {weather && (
          <span className="text-xs text-ink/70 dark:text-parchment/70">
            {new Date(`${weather.record_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
          </span>
        )}
      </div>
      <dl className="text-sm">
        <Row label="Rain" value={weather ? num(weather.rainfall_mm, " mm") : "No data"} />
        <Row label="Temperature" value={weather ? num(weather.temperature_c, " °C") : "No data"} />
        <Row label="Air moisture (humidity)" value={weather ? num(weather.humidity_pct, "%") : "No data"} />
        <Row
          label="Days without rain"
          value={drySpellDays === null ? "No data" : `${drySpellDays} day${drySpellDays === 1 ? "" : "s"}`}
          watch={dryWatch}
        />
      </dl>
    </div>
  );
}

function Row({ label, value, watch = false }: { label: string; value: string; watch?: boolean }) {
  return (
    <div className="flex h-10 items-center justify-between gap-3 border-b border-canopy-900/5 last:border-0 dark:border-white/5">
      <dt className="truncate text-ink/70 dark:text-parchment/70">{label}</dt>
      <dd className={`flex shrink-0 items-center gap-2 font-semibold tabular-nums ${watch ? "text-laterite-700 dark:text-laterite-600" : "text-ink dark:text-parchment"}`}>
        {watch && (
          <span className="rounded-full bg-laterite-50 px-2 py-0.5 text-xs font-semibold text-laterite-700">Watch</span>
        )}
        {value}
      </dd>
    </div>
  );
}
