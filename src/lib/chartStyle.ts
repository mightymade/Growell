/**
 * One look for every chart. Recharts needs literal colours, not CSS
 * classes, so these are picked per theme here.
 *
 * Series colours were checked with the dataviz palette validator against
 * the card surface in each theme (lightness, colour strength, colour-blind
 * separation, contrast): green for crop health, blue for rain.
 */
export type ChartColors = {
  health: string;
  rain: string;
  alert: string;
  grid: string;
  axisText: string;
  surface: string;
  marker: string;
};

export function chartColors(isDark: boolean): ChartColors {
  return isDark
    ? {
        health: "#22A159",
        rain: "#4A9AD0",
        alert: "#E07A4F",
        grid: "rgba(255, 255, 255, 0.07)",
        axisText: "rgba(242, 244, 243, 0.65)",
        surface: "#181818",
        marker: "rgba(242, 244, 243, 0.45)",
      }
    : {
        health: "#15884A",
        rain: "#2B79AD",
        alert: "#C1592D",
        grid: "#ECEFED",
        axisText: "rgba(22, 36, 28, 0.65)",
        surface: "#FFFFFF",
        marker: "rgba(22, 36, 28, 0.35)",
      };
}

export const AXIS_FONT = { fontSize: 12, fontFamily: "inherit" } as const;

/** "Jul 16" */
export function shortDay(d: Date | number | string): string {
  const date = typeof d === "string" ? new Date(`${d.slice(0, 10)}T00:00:00`) : new Date(d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * The field page stacks the crop health and rain charts, so a farmer can
 * read straight down from a dip in health to the rain under it. Both use
 * these, so the same date sits at the same place in both plots.
 */
export const CHART_MARGIN = { top: 12, right: 0, left: 8, bottom: 0 } as const;
export const Y_AXIS_WIDTH = 80;
export const X_TICK_COUNT = 4;

/** The period both stacked charts cover, as plain ISO dates. */
export type ChartRange = { start: string; end: string };

/**
 * Date labels for the stacked charts: one in the middle of each of `count`
 * equal parts of the period. Unlike labels at the very edges, these never
 * get dropped for lack of room, so both charts always show all of them.
 */
export function insetTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min];
  const part = (max - min) / count;
  return Array.from({ length: count }, (_, i) => Math.round(min + part * (i + 0.5)));
}

/** A calendar date as a timestamp at local midnight (how both charts place dates). */
export function dayTime(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
}
