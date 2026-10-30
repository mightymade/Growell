import { useEffect, useRef, useState } from "react";
import type { NdviPoint, WeatherPoint } from "../lib/types";

type Props = {
  ndviHistory: NdviPoint[];
  weatherHistory: WeatherPoint[];
  anomalyDates: string[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
};

const PLAY_INTERVAL_MS = 450;

/**
 * A "timelapse" for data we actually have — there's no stored satellite
 * photo per day (the schema only keeps a single NDVI number), so this
 * scrubs through *readings* rather than images: drag it, or hit play and
 * watch a marker sweep the charts while NDVI/weather update live. Synced
 * with NdviChart and RainfallChart via the selectedDate prop they share.
 */
export default function SeasonScrubber({
  ndviHistory,
  weatherHistory,
  anomalyDates,
  selectedDate,
  onSelectDate,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dates = ndviHistory.map((d) => d.capture_date);
  const selectedIndex = selectedDate ? dates.indexOf(selectedDate) : dates.length - 1;
  const index = selectedIndex === -1 ? dates.length - 1 : selectedIndex;

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const next = index + 1;
      if (next >= dates.length) {
        setPlaying(false);
        return;
      }
      onSelectDate(dates[next]);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, PLAY_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index]);

  if (dates.length < 2) return null; // nothing meaningful to scrub through yet

  const reading = ndviHistory[index];
  const weather = weatherHistory.find((w) => w.record_date === reading.capture_date);
  const isFlagged = anomalyDates.includes(reading.capture_date);
  const fillPct = (index / (dates.length - 1)) * 100;

  function togglePlay() {
    if (!playing && index >= dates.length - 1) onSelectDate(dates[0]); // restart from the beginning
    setPlaying((p) => !p);
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-night-900 shadow-sm shadow-canopy-900/5 dark:shadow-none p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-sm font-semibold text-ink dark:text-parchment">Season replay</p>
        <span className="text-xs text-ink/70 dark:text-parchment/70">
          {index + 1} of {dates.length} readings
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-growth-600 text-white hover:bg-growth-600/90"
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="1" width="4" height="12" rx="1" />
              <rect x="8" y="1" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M2.5 1.5v11l9-5.5-9-5.5z" />
            </svg>
          )}
        </button>

        <input
          type="range"
          className="season-slider flex-1"
          style={{ ["--slider-fill" as string]: `${fillPct}%` }}
          min={0}
          max={dates.length - 1}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            onSelectDate(dates[Number(e.target.value)]);
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-canopy-900/5 dark:border-white/5 pt-3">
        <span className="text-sm font-semibold text-ink dark:text-parchment">{reading.capture_date}</span>
        <span className="text-sm text-ink/70 dark:text-parchment/70">
          NDVI <span className="font-semibold text-ink dark:text-parchment">{Number(reading.ndvi_value).toFixed(2)}</span>
        </span>
        {weather && (
          <span className="text-sm text-ink/70 dark:text-parchment/70">
            Rain <span className="font-semibold text-ink dark:text-parchment">{weather.rainfall_mm?.toFixed(0) ?? "—"} mm</span>
          </span>
        )}
        {isFlagged && (
          <span className="rounded-full bg-laterite-100 px-2 py-0.5 text-xs font-medium text-laterite-700">
            Flagged
          </span>
        )}
      </div>
    </div>
  );
}
