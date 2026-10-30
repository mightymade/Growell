/**
 * NDVI colour scale, from bare soil to dense crop.
 * KEEP IN SYNC with the ramp in supabase/functions/field-frame/index.ts,
 * which colours the map pictures. This copy colours the legend and the
 * season track under the map, so all three always agree.
 */
const STOPS: [number, [number, number, number]][] = [
  [0.0, [138, 106, 74]],
  [0.2, [184, 155, 94]],
  [0.35, [212, 196, 90]],
  [0.5, [140, 193, 82]],
  [0.65, [63, 163, 77]],
  [0.8, [30, 123, 58]],
];

export function ndviColor(value: number): string {
  const v = Math.min(0.8, Math.max(0, Number.isFinite(value) ? value : 0));
  for (let i = 1; i < STOPS.length; i++) {
    const [x1, c1] = STOPS[i];
    const [x0, c0] = STOPS[i - 1];
    if (v <= x1) {
      const t = (v - x0) / (x1 - x0);
      const c = c0.map((ch, k) => Math.round(ch + (c1[k] - ch) * t));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  return `rgb(${STOPS[STOPS.length - 1][1].join(", ")})`;
}

/** Legend bar: the scale from 0 to 0.8, left to right. */
export const NDVI_LEGEND_GRADIENT = `linear-gradient(to right, ${STOPS.map(
  ([x, c]) => `rgb(${c.join(", ")}) ${(x / 0.8) * 100}%`,
).join(", ")})`;

/** Plain-language meaning of an NDVI value. */
export function ndviLabel(value: number): string {
  if (value < 0.2) return "bare or very sparse";
  if (value < 0.4) return "thin cover";
  if (value < 0.6) return "growing well";
  return "dense, healthy cover";
}

/** One word for crop health, for farmers who don't know what NDVI is. */
export function healthWord(value: number): string {
  if (value < 0.2) return "Poor";
  if (value < 0.4) return "Fair";
  if (value < 0.6) return "Good";
  return "Very good";
}

/** Direction between two readings in words. Small changes are "Steady"
 *  so normal day-to-day noise doesn't look like news. */
export function healthTrend(prev: number | null | undefined, curr: number): { label: string; positive: boolean } | null {
  if (prev === null || prev === undefined || !Number.isFinite(prev) || prev <= 0) return null;
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 5) return { label: "Steady", positive: true };
  return pct > 0 ? { label: "Improving", positive: true } : { label: "Falling", positive: false };
}
