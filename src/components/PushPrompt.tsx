import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { pushState, turnOnPush, type PushState } from "../lib/push";
import { BellIcon, CloseIcon } from "./icons";
import { BusyLabel } from "./Busy";

const KEY = "growell_push_prompt_dismissed";

/**
 * A small card on Home inviting the farmer to get alerts in the
 * notification bar. Shown only when notifications are off on this device,
 * and never again once dismissed here.
 */
export default function PushPrompt() {
  const [state, setState] = useState<PushState | null>(null);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hidden) pushState().then(setState);
  }, [hidden]);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // shows again next time; harmless
    }
  }

  if (hidden || (state !== "off" && state !== "ios-needs-install")) return null;

  return (
    <section aria-label="Notifications" className="mb-6 flex items-start gap-3 rounded-xl bg-white p-4 shadow-e1 dark:bg-night-900">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-growth-50 text-growth-700">
        <BellIcon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink dark:text-parchment">Get crop alerts on this device</p>
        <p className="mt-0.5 text-sm text-ink/70 dark:text-parchment/70">
          {state === "ios-needs-install"
            ? "On iPhone, add Growell to your Home Screen first (Share, then Add to Home Screen), then turn notifications on in Settings."
            : "Growell will tell you in your notification bar when a field needs attention, plus a short report every Monday."}
        </p>
        {error && <p role="alert" className="mt-2 text-sm text-laterite-700">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {state === "off" ? (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const s = await turnOnPush();
                  setState(s);
                  if (s === "blocked") setError("Notifications are blocked in this browser. You can allow them in its settings.");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Couldn't turn notifications on.");
                } finally {
                  setBusy(false);
                }
              }}
              className="inline-flex h-11 items-center rounded-lg bg-growth-600 px-4 text-sm font-semibold text-white hover:bg-growth-700 disabled:opacity-50 md:h-10"
            >
              <BusyLabel busy={busy} label="Turn on" busyLabel="Turning on…" />
            </button>
          ) : (
            <Link to="/settings/notifications" className="inline-flex h-11 items-center rounded-lg border border-canopy-900/12 px-4 text-sm font-medium text-ink dark:border-white/15 dark:text-parchment md:h-10">
              How to
            </Link>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-ink/70 hover:bg-parchment dark:text-parchment/70 dark:hover:bg-white/5 md:h-10"
          >
            Not now
          </button>
        </div>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="-m-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink/50 hover:bg-parchment dark:text-parchment/50 dark:hover:bg-white/5">
        <CloseIcon size={14} />
      </button>
    </section>
  );
}
