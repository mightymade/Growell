import { useEffect, useState } from "react";

/**
 * True only during a chart's first 700ms on screen. Pass it to Recharts'
 * isAnimationActive so a chart draws itself in once (600ms), then stays
 * still when its data refreshes or the season slider moves. Always false
 * for people who ask their device to reduce motion.
 */
export function useAnimateOnce() {
  const [active, setActive] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 700);
    return () => clearTimeout(t);
  }, [active]);
  return active;
}
