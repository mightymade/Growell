import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "../hooks/useTheme";
import { useIsPhone } from "../hooks/useIsPhone";
import { AXIS_FONT, chartColors } from "../lib/chartStyle";
import ChartTooltip, { KeyDot } from "../components/ChartTooltip";
import { card } from "./ui";
import { shortDate } from "./format";

type Point = { key: string; count: number };

const MARGIN = { top: 8, right: 24, left: 0, bottom: 0 } as const;

/** A round top for the y axis and evenly spaced whole-number steps to it. */
function niceTicks(max: number): number[] {
  const raw = Math.max(4, max) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw && Number.isInteger(s)) ?? Math.ceil(raw);
  return [0, 1, 2, 3, 4].map((i) => i * step);
}

/**
 * A single-series count chart (bars or a line) in a card. One series, so
 * the title names it and there is no legend box. Grid and axes stay quiet;
 * hovering shows the exact number. Screen readers get a one-line summary.
 */
export function CountChart({
  title,
  summary,
  data,
  kind,
  unit,
  tooltipTitle,
  tone = "health",
  height = 220,
  fill = false,
}: {
  title: string;
  summary: string;
  data: Point[];
  kind: "bar" | "line";
  /** Words after the number in the tooltip, e.g. "new users". */
  unit: (n: number) => string;
  tooltipTitle: (key: string) => string;
  tone?: "health" | "alert" | "rain";
  height?: number;
  /** Fill the card's height on a computer screen with room, like the farmer charts. */
  fill?: boolean;
}) {
  const { isDark } = useTheme();
  const c = chartColors(isDark);
  const color = c[tone];
  const max = Math.max(0, ...data.map((d) => d.count));
  const isPhone = useIsPhone();
  // Bars are narrow and dates long: fewer labels, so they never run together.
  const tickEvery = Math.max(1, Math.ceil(data.length / (isPhone || kind === "bar" ? 4 : 6)));
  const yTicks = niceTicks(max);
  const ticks = data.filter((_, i) => (data.length - 1 - i) % tickEvery === 0).map((d) => d.key);

  const tooltip = (
    <Tooltip
      cursor={kind === "bar" ? { fill: c.grid } : { stroke: c.marker, strokeWidth: 1 }}
      content={({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const p = payload[0].payload as Point;
        return (
          <ChartTooltip title={tooltipTitle(p.key)}>
            <p className="flex items-center gap-2">
              <KeyDot color={color} />
              <span className="font-semibold tabular-nums">{p.count}</span> {unit(p.count)}
            </p>
          </ChartTooltip>
        );
      }}
    />
  );
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke={c.grid} />
      <XAxis
        dataKey="key"
        ticks={ticks}
        interval={0}
        tickFormatter={(k: string) => shortDate(k)}
        tick={{ ...AXIS_FONT, fill: c.axisText }}
        tickLine={false}
        axisLine={false}
        tickMargin={8}
      />
      <YAxis
        allowDecimals={false}
        domain={[0, yTicks[yTicks.length - 1]]}
        ticks={yTicks}
        width={40}
        tick={{ ...AXIS_FONT, fill: c.axisText }}
        tickLine={false}
        axisLine={false}
      />
    </>
  );

  return (
    <section className={`${card} flex flex-col p-4 md:p-6 tall:min-h-0 tall:p-4 ${fill ? "tall:h-full" : ""}`} aria-label={title}>
      <h2 className="shrink-0 text-base font-semibold text-ink dark:text-parchment">{title}</h2>
      <p className="sr-only">{summary}</p>
      <div
        className={`mt-4 ${fill ? "h-[220px] tall:mt-3 tall:h-0 tall:min-h-[140px] tall:grow tall:basis-0" : ""}`}
        style={fill ? undefined : { height }}
        aria-hidden
      >
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? (
            <BarChart data={data} margin={MARGIN} barCategoryGap="24%">
              {axes}
              {tooltip}
              <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={MARGIN}>
              {axes}
              {tooltip}
              <Line
                dataKey="count"
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: color, stroke: c.surface, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
