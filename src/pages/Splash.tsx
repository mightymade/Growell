import { useEffect, useState } from "react";

/**
 * Shown while the app starts or while a page's code downloads.
 *
 * Most loads finish in well under half a second, so nothing appears for
 * the first 400 ms: a quick load shows no loader at all instead of a
 * flash. Only a genuinely slow load gets the logo and a thin progress
 * bar. It uses the page's own background, so it matches light and dark
 * mode instead of flashing a dark screen.
 */
const DELAY_MS = 400;

export default function Splash() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-svh items-center justify-center px-6" role="status" aria-live="polite">
      {show && (
        <div className="splash-in flex flex-col items-center">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="" className="h-8 w-8" />
            <span className="font-display text-xl font-semibold tracking-tight text-ink dark:text-parchment">Growell</span>
          </div>
          <div className="mt-6 h-0.5 w-32 overflow-hidden rounded-full bg-canopy-900/10 dark:bg-white/10" aria-hidden>
            <div className="splash-bar h-full w-1/3 rounded-full bg-growth-600 dark:bg-growth-500" />
          </div>
          <span className="sr-only">Loading Growell</span>
        </div>
      )}
    </div>
  );
}
