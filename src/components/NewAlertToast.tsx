import { useCallback, useEffect, useState } from "react";
import type { AlertToast } from "../hooks/useLiveAlerts";
import { SEVERITY_DOT } from "../lib/alertText";
import { BellIcon } from "./icons";

const SHOW_MS = 8000;

/**
 * Pops up when a new alert arrives while the app is open. Sits bottom
 * right on a computer and above the tab bar on a phone. Stays while the
 * pointer or keyboard focus is on it, then hides after 8 seconds.
 * Announced politely to screen readers.
 */
export default function NewAlertToast({
  toast,
  onView,
  onDismiss,
}: {
  toast: AlertToast | null;
  onView: (t: AlertToast) => void;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Slide down and fade before going, instead of vanishing.
  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => {
      setLeaving(false);
      onDismiss();
    }, 160);
  }, [onDismiss]);

  useEffect(() => {
    if (!toast || paused) return;
    const t = setTimeout(dismiss, SHOW_MS);
    return () => clearTimeout(t);
  }, [toast, paused, dismiss]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-20 z-[1000] flex justify-end md:bottom-6 md:right-6 md:left-auto">
      {toast && (
        <div
          key={toast.key}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className={`${leaving ? "m-out" : "toast-in"} pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-white p-4 shadow-e2 ring-1 ring-canopy-900/10 dark:bg-night-900 dark:ring-white/10`}
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-laterite-50 text-laterite-700">
            <BellIcon size={16} />
            <span className={`absolute -right-1 -top-1 h-3 w-3 rounded-full ring-2 ring-white dark:ring-night-900 ${SEVERITY_DOT[toast.first.severity]}`} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink dark:text-parchment">
              {toast.count === 1 ? `New alert on ${toast.first.field_name}` : `${toast.count} new alerts`}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-ink/70 dark:text-parchment/70">
              {toast.count === 1 ? toast.first.message_text : `Including ${toast.first.field_name}. Open Alerts to see them all.`}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onView(toast)}
                className="h-8 rounded-md bg-growth-600 px-3 text-xs font-semibold text-white hover:bg-growth-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-growth-600"
              >
                {toast.count === 1 ? "View alert" : "View alerts"}
              </button>
              <button
                onClick={dismiss}
                className="h-8 rounded-md px-3 text-xs font-medium text-ink/70 hover:bg-parchment hover:text-ink dark:text-parchment/70 dark:hover:bg-white/5 dark:hover:text-parchment"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
