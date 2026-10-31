import { useAnimateOnce } from "../hooks/useAnimateOnce";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { WeatherPoint } from "../lib/types";
import { useTheme } from "../hooks/useTheme";
import { AXIS_FONT, CHART_MARGIN, X_TICK_COUNT, Y_AXIS_WIDTH, chartColors, dayTime, insetTicks, shortDay, type ChartRange } from "../lib/chartStyle";
import ChartTooltip, { KeyDot } from "./ChartTooltip";

type Props = {
  data: WeatherPoint[];
  /** Shared with the crop health chart, so dates line up when they are stacked. */
  range: ChartRange;
};

const DAY = 86_400_000;

/** mid: the middle of the week on the shared timeline, where its bar sits. */
type Week = { start: string; end: string; mid: number; total: number; rainyDays: number; wettest: number };

/**
 * Daily rain grouped into weeks, counted back from the end of the range.
 * Weeks that would start before the range are dropped, so every bar sits
 * fully inside the chart.
 */
function toWeeks(data: WeatherPoint[], range: ChartRange): Week[] {
  if (data.length === 0) return [];
  const byDay = new Map(data.map((d) => [d.record_date, d.rainfall_mm ?? 0]));
  // UTC on purpose: dates are plain calendar days, and mixing local time
  // with toISOString() would shift every day by one in Uganda (UTC+3).
  const last = new Date(`${range.end}T00:00:00Z`).getTime();
  const first = new Date(`${range.start}T00:00:00Z`).getTime();
  const weeks: Week[] = [];
  for (let i = 0; ; i++) {
    const endT = last - i * 7 * DAY;
    const startT = endT - 6 * DAY;
    if (startT < first) break;
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
    const start = new Date(startT).toISOString().slice(0, 10);
    weeks.unshift({
      start,
      end: new Date(endT).toISOString().slice(0, 10),
      mid: dayTime(start) + 3.5 * DAY,
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
 * four weeks' total.
 */
export default function RainfallChart({ data, range }: Props) {
  const animate = useAnimateOnce();
  const { isDark } = useTheme();
  const c = chartColors(isDark);

  const weeks = toWeeks(data, range);
  const domain: [number, number] = [dayTime(range.start), dayTime(range.end)];
  const ticks = insetTicks(domain[0], domain[1], X_TICK_COUNT);
  const recent = weeks.slice(-4);
  const recentTotal = Math.round(recent.reduce((s, w) => s + w.total, 0));
  const top = niceTop(Math.max(1, ...weeks.map((w) => w.total)));

  const summary = weeks.length
    ? `${recentTotal} millimetres of rain in the last ${recent.length} weeks. Weekly totals for the last ${weeks.length} weeks, from ${shortDay(weeks[0].start)}.`
    : "";

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl bg-white p-4 shadow-e1 dark:bg-night-900" aria-labelledby="rain-chart-title">
      <h3 id="rain-chart-title" className="text-sm font-medium text-ink/70 dark:text-parchment/70">
        Rain per week (mm)
      </h3>
      {weeks.length === 0 ? (
        <>
          <p className="mt-1 font-display tracking-tight text-2xl font-semibold text-ink/65 dark:text-parchment/65">No data yet</p>
          <div className="flex flex-1 items-center justify-center py-10 text-center text-sm text-ink/70 dark:text-parchment/70">
            Weather history appears here a minute after a field is added.
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-ink dark:text-parchment">{recentTotal} mm</span>
            <span className="text-sm text-ink/65 dark:text-parchment/65">in the last {recent.length === 1 ? "week" : `${recent.length} weeks`}</span>
          </p>
          <p className="sr-only">{summary}</p>
          {/* On computers the plot has no height of its own (h-0) and takes
              whatever the card is given, so the page can fit one screen. */}
          <div className="mt-3 h-[220px] lg:h-0 lg:min-h-[160px] lg:grow lg:basis-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks} margin={CHART_MARGIN} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke={c.grid} />
                {/* A real time axis (not one slot per week), so the dates match
                    the crop health chart above exactly. */}
                <XAxis
                  dataKey="mid"
                  type="number"
                  scale="time"
                  domain={domain}
                  allowDataOverflow
                  ticks={ticks}
                  interval={0}
                  tickFormatter={shortDay}
                  tick={{ ...AXIS_FONT, fill: c.axisText }}
                  axisLine={{ stroke: c.grid }}
                  tickLine={false}
                  tickMargin={8}
                />
                {/* Numbers only; the unit is in the card title. */}
                <YAxis
                  orientation="right"
                  domain={[0, top]}
                  ticks={[0, top / 2, top]}
                  tick={{ ...AXIS_FONT, fill: c.axisText }}
                  axisLine={false}
                  tickLine={false}
                  width={Y_AXIS_WIDTH}
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
                  barSize={14}
                  fill={c.rain}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
