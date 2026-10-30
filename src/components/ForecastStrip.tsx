import type { ForecastDay } from "../hooks/useWeatherForecast";
import { Skeleton } from "./Skeleton";

export default function ForecastStrip({ forecast, loading }: { forecast: ForecastDay[]; loading: boolean }) {
  const dayLabel = (dateStr: string) =>
    new Date(dateStr + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });

  return (
    <div className="rounded-xl bg-white dark:bg-night-900 shadow-e1 p-4">
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
        <div className="grid grid-cols-5 gap-2">
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
