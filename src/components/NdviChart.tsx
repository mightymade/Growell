import { useAnimateOnce } from "../hooks/useAnimateOnce";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { NdviPoint } from "../lib/types";
import { useTheme } from "../hooks/useTheme";
import { MIN_RELIABLE_HECTARES } from "../lib/fieldSize";
import { healthTrend, healthWord } from "../lib/ndviColor";
import { AXIS_FONT, CHART_MARGIN, X_TICK_COUNT, Y_AXIS_WIDTH, chartColors, dayTime, insetTicks, shortDay, type ChartRange } from "../lib/chartStyle";
import ChartTooltip, { KeyDot } from "./ChartTooltip";

type Props = {
  data: NdviPoint[];
  anomalyDates?: string[];
  /** Lets the empty and "rough reading" notes mention small fields. */
  areaHectares?: number | null;
  /** Shared with the rain chart, so dates line up when they are stacked. */
  range: ChartRange;
};

// Health words sit in bands between these scores (see lib/ndviColor.ts).
const BAND_LINES = [0.2, 0.4, 0.6];
const BAND_LABELS: Record<number, string> = { 0.1: "Poor", 0.3: "Fair", 0.5: "Good", 0.7: "Very good" };

/**
 * Crop health over the season. Leads with today's health in a word, then a
 * single thin line over a faint wash on a real time axis (readings are
 * days apart, not evenly spaced). The side shows Poor / Fair / Good /
 * Very good bands instead of raw scores. Drops Growell alerted on are
 * marked with an orange dot.
 */
export default function NdviChart({ data, anomalyDates = [], areaHectares = null, range }: Props) {
  const animate = useAnimateOnce();
  const { isDark } = useTheme();
  const c = chartColors(isDark);
  const anomalySet = new Set(anomalyDates);

  const points = data.map((d) => ({
    t: dayTime(d.capture_date),
    date: d.capture_date,
    ndvi: Number(d.ndvi_value),
    isAnomaly: anomalySet.has(d.capture_date),
  }));

  const latest = points[points.length - 1];
  const trend = points.length >= 2 ? healthTrend(points[points.length - 2].ndvi, latest.ndvi) : null;
  const isSmallField = areaHectares !== null && areaHectares < MIN_RELIABLE_HECTARES;
  const latestIsApproximate = data.length > 0 && data[data.length - 1].is_approximate === true;
  const showApproximate = data.length > 0 && (latestIsApproximate || isSmallField);
  const approximateHint = latestIsApproximate
    ? "Your drawn boundary gave no clear pixels, so this reading comes from a small square around the centre of your field."
    : `This field is under ${MIN_RELIABLE_HECTARES} ha, so nearby ground mixes into the reading. Watch the trend more than any single value.`;

  // The same period as the rain chart below it, so dates line up.
  const domain: [number, number] = [dayTime(range.start), dayTime(range.end)];
  const ticks = insetTicks(domain[0], domain[1], X_TICK_COUNT);
  const top = Math.max(0.8, Math.ceil(Math.max(0, ...points.map((p) => p.ndvi)) * 10) / 10);

  function renderDot(props: any) {
    const { cx, cy, payload, index } = props;
    const isLast = index === points.length - 1;
    if (!payload.isAnomaly && !isLast) return <g key={payload.date} />;
    return (
      <circle
        key={payload.date}
        cx={cx}
        cy={cy}
        r={4}
        fill={payload.isAnomaly ? c.alert : c.health}
        stroke={c.surface}
        strokeWidth={2}
      />
    );
  }

  const summary = latest
    ? `Crop health is ${healthWord(latest.ndvi).toLowerCase()} (score ${latest.ndvi.toFixed(2)}) on ${shortDay(latest.date)}, from ${points.length} satellite readings since ${shortDay(points[0].date)}.`
    : "";

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl bg-white p-4 shadow-e1 dark:bg-night-900" aria-labelledby="health-chart-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="health-chart-title" className="text-sm font-medium text-ink/70 dark:text-parchment/70">
            Crop health
          </h3>
          {latest ? (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-ink dark:text-parchment">{healthWord(latest.ndvi)}</span>
              <span className="text-sm text-ink/65 dark:text-parchment/65">
                {trend && trend.label !== "Steady" ? `${trend.label.toLowerCase()}, ` : ""}
                {shortDay(latest.date)}
              </span>
            </p>
          ) : (
            <p className="mt-1 font-display tracking-tight text-2xl font-semibold text-ink/65 dark:text-parchment/65">No reading yet</p>
          )}
        </div>
        {showApproximate && (
          <span className="shrink-0 rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700" title={approximateHint}>
            Rough reading
          </span>
        )}
      </div>

      {points.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-10 text-center text-sm text-ink/70 dark:text-parchment/70">
          <p className="font-medium text-ink dark:text-parchment">No clear satellite image yet</p>
          <p className="max-w-xs">
            The satellite passes every 2 to 5 days and cloudy passes are skipped. Tap "Check for new images" at the top to look
            again.
          </p>
          {isSmallField && (
            <p className="mt-2 max-w-xs">This field is small, so its readings will be marked rough when they arrive.</p>
          )}
        </div>
      ) : (
        <>
          <p className="sr-only">{summary}</p>
          {/* On computers the plot has no height of its own (h-0) and takes
              whatever the card is given, so the page can fit one screen. */}
          <div className="mt-3 h-[220px] lg:h-0 lg:min-h-[160px] lg:grow lg:basis-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={CHART_MARGIN}>
                <defs>
                  <linearGradient id="healthWash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.health} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={c.health} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                {BAND_LINES.map((y) => (
                  <ReferenceLine key={y} y={y} stroke={c.grid} strokeWidth={1} />
                ))}
                <XAxis
                  dataKey="t"
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
                <YAxis
                  orientation="right"
                  domain={[0, top]}
                  ticks={[0.1, 0.3, 0.5, 0.7]}
                  tickFormatter={(v: number) => BAND_LABELS[v] ?? ""}
                  tick={{ ...AXIS_FONT, fill: c.axisText }}
                  axisLine={false}
                  tickLine={false}
                  width={Y_AXIS_WIDTH}
                />
                <Tooltip
                  cursor={{ stroke: c.marker, strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    const p = active && payload?.[0]?.payload;
                    if (!p) return null;
                    return (
                      <ChartTooltip title={shortDay(p.date)}>
                        <p className="flex items-center gap-2">
                          <KeyDot color={c.health} />
                          <span className="font-semibold">{healthWord(p.ndvi)}</span>
                          <span className="text-ink/65 dark:text-parchment/65">score {p.ndvi.toFixed(2)}</span>
                        </p>
                        {p.isAnomaly && (
                          <p className="flex items-center gap-2">
                            <KeyDot color={c.alert} />
                            Drop detected, alert sent
                          </p>
                        )}
                      </ChartTooltip>
                    );
                  }}
                />
                <Area
                  isAnimationActive={animate}
                  animationDuration={600}
                  animationEasing="ease-out"
                  type="monotone"
                  dataKey="ndvi"
                  stroke={c.health}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="url(#healthWash)"
                  dot={renderDot}
                  activeDot={{ r: 5, fill: c.health, stroke: c.surface, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {anomalyDates.length > 0 && (
            <p className="mt-3 flex items-center gap-2 text-xs text-ink/65 dark:text-parchment/65">
              <KeyDot color={c.alert} />
              Drop detected
            </p>
          )}
        </>
      )}
    </section>
  );
}
