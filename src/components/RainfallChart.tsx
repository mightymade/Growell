import { useAnimateOnce } from "../hooks/useAnimateOnce";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { WeatherPoint } from "../lib/types";
import { useTheme } from "../hooks/useTheme";
import { AXIS_FONT, chartColors, shortDay } from "../lib/chartStyle";
import ChartTooltip, { KeyDot } from "./ChartTooltip";

type Props = {
  data: WeatherPoint[];
  /** Full ISO date selected on the season timelapse; its week is highlighted. */
  selectedDate?: string | null;
};

const DAY = 86_400_000;
const MAX_WEEKS = 12;

type Week = { start: string; end: string; total: number; rainyDays: number; wettest: number };

/** Daily rain grouped into weeks, ending on the latest day we have. */
function toWeeks(data: WeatherPoint[]): Week[] {
  if (data.length === 0) return [];
  const byDay = new Map(data.map((d) => [d.record_date, d.rainfall_mm ?? 0]));
  // UTC on purpose: dates are plain calendar days, and mixing local time
  // with toISOString() would shift every day by one in Uganda (UTC+3).
  const last = new Date(`${data[data.length - 1].record_date}T00:00:00Z`).getTime();
  const first = new Date(`${data[0].record_date}T00:00:00Z`).getTime();
  const weeks: Week[] = [];
  for (let i = 0; i < MAX_WEEKS; i++) {
    const endT = last - i * 7 * DAY;
    const startT = endT - 6 * DAY;
    if (endT < first) break;
    let total = 0;
    let rainyDays = 0;
    let wettest = 0;
    let days = 0;
    for (let t = startT; t <= endT; t += DAY) {
      const key = new Date(t).toISOString().slice(0, 10);
      const mm = byDay.get(key);
      if (mm === undefined) continue;
      days++;
      total += mm;
      if (mm >= 1) rainyDays++;
      wettest = Math.max(wettest, mm);
    }
    if (days === 0) continue;
    weeks.unshift({
      start: new Date(startT).toISOString().slice(0, 10),
      end: new Date(endT).toISOString().slice(0, 10),
      total: Math.round(total * 10) / 10,
      rainyDays,
      wettest: Math.round(wettest * 10) / 10,
    });
  }
  return weeks;
}

/** A clean round top for the y axis: 10, 20, 40, 60, 80, 100… */
function niceTop(max: number) {
  const steps = [10, 20, 40, 60, 80, 100, 150, 200, 300];
  return steps.find((s) => s >= max) ?? Math.ceil(max / 100) * 100;
}

/**
 * Rain per week. Ninety thin daily bars were noise; weekly totals show the
 * pattern a farmer acts on (wet weeks, dry weeks). Leads with the last
 * four weeks' total. The week picked on the season timelapse stays full
 * colour and the others soften, so both charts point at the same moment.
 */
export default function RainfallChart({ data, selectedDate = null }: Props) {
  const animate = useAnimateOnce();
  const { isDark } = useTheme();
  const c = chartColors(isDark);

  const weeks = toWeeks(data);
  const recent = weeks.slice(-4);
  const recentTotal = Math.round(recent.reduce((s, w) => s + w.total, 0));
  const top = niceTop(Math.max(1, ...weeks.map((w) => w.total)));
  const selectedWeek = selectedDate ? weeks.findIndex((w) => selectedDate >= w.start && selectedDate <= w.end) : -1;

  const summary = weeks.length
    ? `${recentTotal} millimetres of rain in the last ${recent.length} weeks. Weekly totals for the last ${weeks.length} weeks, from ${shortDay(weeks[0].start)}.`
    : "";

  return (
    <section className="flex h-full flex-col rounded-xl bg-white p-5 shadow-e1 dark:bg-night-900" aria-labelledby="rain-chart-title">
      <h3 id="rain-chart-title" className="text-sm font-medium text-ink/70 dark:text-parchment/70">
        Rain per week
      </h3>
      {weeks.length === 0 ? (
        <>
          <p className="mt-1 font-display text-2xl font-semibold text-ink/65 dark:text-parchment/65">No data yet</p>
          <div className="flex flex-1 items-center justify-center py-10 text-center text-sm text-ink/70 dark:text-parchment/70">
            Weather history appears here a minute after a field is added.
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-2xl font-semibold text-ink dark:text-parchment">{recentTotal} mm</span>
            <span className="text-sm text-ink/65 dark:text-parchment/65">in the last {recent.length === 1 ? "week" : `${recent.length} weeks`}</span>
          </p>
          <p className="sr-only">{summary}</p>
          <div className="mt-4 flex-1" aria-hidden>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeks} margin={{ top: 8, right: 0, left: 20, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis
                  dataKey="start"
                  tickFormatter={shortDay}
                  tick={{ ...AXIS_FONT, fill: c.axisText }}
                  axisLine={{ stroke: c.grid }}
                  tickLine={false}
                  tickMargin={8}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  orientation="right"
                  domain={[0, top]}
                  ticks={[0, top / 2, top]}
                  tickFormatter={(v: number) => (v === top ? `${v} mm` : String(v))}
                  tick={{ ...AXIS_FONT, fill: c.axisText }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  cursor={{ fill: c.grid }}
                  content={({ active, payload }) => {
                    const w = active && (payload?.[0]?.payload as Week | undefined);
                    if (!w) return null;
                    return (
                      <ChartTooltip title={`${shortDay(w.start)} to ${shortDay(w.end)}`}>
                        <p className="flex items-center gap-2">
                          <KeyDot color={c.rain} />
                          <span className="font-semibold">{w.total} mm</span>
                          <span className="text-ink/65 dark:text-parchment/65">
                            on {w.rainyDays} {w.rainyDays === 1 ? "day" : "days"}
                          </span>
                        </p>
                        {w.wettest > 0 && <p className="text-ink/65 dark:text-parchment/65">Wettest day: {w.wettest} mm</p>}
                      </ChartTooltip>
                    );
                  }}
                />
                <Bar
                  isAnimationActive={animate}
                  animationDuration={600}
                  animationEasing="ease-out"
                  dataKey="total"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                >
                  {weeks.map((w, i) => (
                    <Cell key={w.start} fill={c.rain} fillOpacity={selectedWeek === -1 || selectedWeek === i ? 1 : 0.35} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
