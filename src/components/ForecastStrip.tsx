import type { ForecastDay } from "../hooks/useWeatherForecast";
import { Skeleton } from "./Skeleton";

/**
 * The next five days: rain and high/low temperature per day. Given spare
 * height (beside the map on computers), the tiles stay centred in it.
 */
export default function ForecastStrip({
  forecast,
  loading,
  className = "",
}: {
  forecast: ForecastDay[];
  loading: boolean;
  className?: string;
}) {
  const dayLabel = (dateStr: string) =>
    new Date(dateStr + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });

  return (
    <div className={`flex flex-col rounded-xl bg-white p-4 shadow-e1 dark:bg-night-900 ${className}`}>
      <p className="mb-3 font-display text-sm font-semibold text-ink dark:text-parchment">Next 5 days</p>
      {loading && forecast.length === 0 ? (
        <div className="grid grid-cols-5 gap-2" role="status" aria-label="Loading forecast">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[74px]" />
          ))}
        </div>
      ) : forecast.length === 0 ? (
        <p className="text-sm text-ink/70 dark:text-parchment/70">Forecast unavailable.</p>
      ) : (
        <div className="grid flex-1 grid-cols-5 content-center gap-2">
          {forecast.map((day, i) => (
            <div key={day.date} className="rounded-lg bg-parchment dark:bg-night-950 px-1 py-2 text-center">
              <p className="text-xs font-medium text-ink/70 dark:text-parchment/70">{i === 0 ? "Today" : dayLabel(day.date)}</p>
              <p className="mt-1 text-sm font-semibold text-sky-700">{day.rainfallMm.toFixed(0)}mm</p>
              <p className="mt-1 text-xs text-ink/70 dark:text-parchment/70">
                {day.tempMaxC.toFixed(0)}°/{day.tempMinC.toFixed(0)}°
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
