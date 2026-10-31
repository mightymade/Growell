import { useEffect, useRef, useState, type ReactNode } from "react";

type Trend = { label: string; positive: boolean } | null;

type Props = {
  icon: ReactNode;
  iconTint: "growth" | "sky" | "laterite" | "canopy";
  label: string;
  value: string;
  trend?: Trend;
};

const TINTS: Record<Props["iconTint"], string> = {
  growth: "bg-growth-100 text-growth-700",
  sky: "bg-sky-100 text-sky-700",
  laterite: "bg-laterite-100 text-laterite-700",
  canopy: "bg-canopy-900/10 text-canopy-900 dark:bg-white/10 dark:text-parchment",
};

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A number that counts to its new value over 600ms instead of jumping.
 * Works on values like "3", "9.0 mm" or "12 days"; anything else (such as
 * "Good") cross-fades instead.
 */
function AnimatedValue({ value }: { value: string }) {
  const match = /^(-?\d+(?:\.\d+)?)(.*)$/.exec(value);
  const target = match ? Number(match[1]) : null;
  const decimals = match && match[1].includes(".") ? match[1].split(".")[1].length : 0;
  const suffix = match ? match[2] : "";
  const [shown, setShown] = useState<number | null>(() => (target === null || reduceMotion() ? target : 0));
  const from = useRef(shown ?? 0);

  useEffect(() => {
    if (target === null) return;
    if (reduceMotion()) {
      setShown(target);
      return;
    }
    const start = performance.now();
    const begin = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 600);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = begin + (target - begin) * eased;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (target === null || shown === null) {
    return (
      <span key={value} className="m-in inline-block">
        {value}
      </span>
    );
  }
  return (
    <>
      <span aria-hidden>
        {shown.toFixed(decimals)}
        {suffix}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}

/**
 * Compact summary card: icon on the left, the number and its label beside
 * it. The status badge sits top right on wide screens and drops under the
 * label on narrower ones, so it never overlaps the number.
 */
export default function IconStatCard({ icon, iconTint, label, value, trend }: Props) {
  return (
    <div className="relative flex items-start gap-3 rounded-xl bg-white p-3 shadow-e1 dark:bg-night-900 sm:p-4 lg:gap-2 lg:p-3 xl:gap-3 xl:p-4">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4 ${TINTS[iconTint]}`}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`font-display text-lg font-semibold leading-7 text-ink tabular-nums dark:text-parchment ${
            trend ? "xl:pr-24" : ""
          }`}
        >
          <AnimatedValue value={value} />
        </p>
        <p className="text-xs leading-4 text-ink/70 dark:text-parchment/70 sm:text-sm sm:leading-5 lg:text-xs lg:leading-4 xl:text-sm xl:leading-5">{label}</p>
        {trend && (
          <span
            className={`mt-2 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold xl:absolute xl:right-4 xl:top-4 xl:mt-0 ${
              trend.positive ? "bg-growth-100 text-growth-700" : "bg-laterite-100 text-laterite-700"
            }`}
          >
            {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}
