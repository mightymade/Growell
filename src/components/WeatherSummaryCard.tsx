import type { WeatherSummary } from "../lib/types";

export default function WeatherSummaryCard({ weather, className = "" }: { weather: WeatherSummary | null; className?: string }) {
  return (
    <div className={`flex flex-col rounded-xl bg-white dark:bg-night-900 shadow-e1 p-4 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="font-display text-sm font-semibold text-ink dark:text-parchment">Latest weather</p>
        {weather && (
          <span className="text-xs text-ink/70 dark:text-parchment/70">
            {new Date(`${weather.record_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-evenly gap-3 text-sm">
        <Row label="Rain" value={weather ? `${weather.rainfall_mm?.toFixed(0) ?? "No data"} mm` : "No data"} />
        <Row label="Temperature" value={weather ? `${weather.temperature_c?.toFixed(0) ?? "No data"} °C` : "No data"} />
        <Row label="Air moisture (humidity)" value={weather ? `${weather.humidity_pct?.toFixed(0) ?? "No data"}%` : "No data"} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-canopy-900/5 dark:border-white/5 pb-3 last:border-0 last:pb-0">
      <span className="text-ink/70 dark:text-parchment/70">{label}</span>
      <span className="font-medium text-ink dark:text-parchment">{value}</span>
    </div>
  );
}
