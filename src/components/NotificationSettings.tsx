import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  fetchNotifyPrefs,
  pushState,
  saveNotifyPrefs,
  sendTestPush,
  turnOffPush,
  turnOnPush,
  type NotifyPrefs,
  type PushState,
} from "../lib/push";
import { BusyLabel } from "./Busy";

const btn =
  "inline-flex h-12 w-full items-center justify-center rounded-lg border border-canopy-900/12 px-4 text-base font-medium text-ink transition-colors hover:bg-parchment active:bg-parchment disabled:opacity-50 dark:border-white/15 dark:text-parchment dark:hover:bg-white/5 md:h-10 md:w-auto md:text-sm";
const primary =
  "inline-flex h-12 w-full items-center justify-center rounded-lg bg-growth-600 px-4 text-base font-semibold text-white transition-colors hover:bg-growth-700 disabled:opacity-50 md:h-10 md:w-auto md:text-sm";

/** Settings, Notifications: this device on or off, and what to be told about. */
export default function NotificationSettings() {
  const [state, setState] = useState<PushState | null>(null);
  const [prefs, setPrefs] = useState<NotifyPrefs | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    pushState().then(setState);
    supabase.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user.id ?? null;
      setUserId(id);
      if (id) setPrefs(await fetchNotifyPrefs(id));
    });
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePref(key: keyof NotifyPrefs) {
    if (!userId || !prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await saveNotifyPrefs(userId, { [key]: next[key] });
    } catch (err) {
      setPrefs(prefs);
      setError(err instanceof Error ? err.message : "Couldn't save that setting.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-canopy-900/5 pb-6 dark:border-white/5">
        <div className="max-w-lg">
          <p className="text-sm font-medium text-ink dark:text-parchment">Notifications on this device</p>
          <p className="mt-1 text-sm text-ink/65 dark:text-parchment/65" aria-live="polite">
            {state === null && "Checking…"}
            {state === "on" && "On. Alerts appear in this device's notification bar, even when Growell is closed."}
            {state === "off" && "Off. Turn on to get alerts in this device's notification bar, even when Growell is closed."}
            {state === "blocked" &&
              "Blocked in this browser's settings. To allow them, tap the lock or settings icon next to the web address, find Notifications, and choose Allow. Then come back here."}
            {state === "unsupported" && "This browser can't show notifications. Try Chrome, Edge, Firefox or Safari."}
            {state === "ios-needs-install" &&
              "On iPhone and iPad, first add Growell to your Home Screen: tap the Share button, then Add to Home Screen. Open Growell from the new icon, then turn notifications on here."}
          </p>
        </div>
        {state === "off" && (
          <button type="button" className={primary} disabled={busy} onClick={() => run(async () => setState(await turnOnPush()))}>
            <BusyLabel busy={busy} label="Turn on" busyLabel="Turning on…" />
          </button>
        )}
        {state === "on" && (
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const n = await sendTestPush();
                  setNote(n > 0 ? "Test sent. It should appear in a few seconds." : "No device received it. Try turning notifications off and on again.");
                })
              }
            >
              Send a test
            </button>
            <button type="button" className={btn} disabled={busy} onClick={() => run(async () => setState(await turnOffPush()))}>
              Turn off
            </button>
          </div>
        )}
        {error && <p role="alert" className="w-full rounded-lg bg-laterite-50 px-3 py-2 text-sm text-laterite-700">{error}</p>}
        {note && <p role="status" className="w-full text-sm text-growth-700 dark:text-growth-500">{note}</p>}
      </div>

      {prefs && (
        <fieldset className="space-y-1">
          <legend className="mb-2 text-sm font-medium text-ink dark:text-parchment">What to tell me about</legend>
          <Toggle
            label="Problems with my crops"
            note="When the satellite spots a drop in a field's health."
            checked={prefs.notify_alerts}
            onChange={() => togglePref("notify_alerts")}
          />
          <Toggle
            label="Weekly field report"
            note="Every Monday morning: how each field is doing, and any alerts waiting."
            checked={prefs.notify_weekly}
            onChange={() => togglePref("notify_weekly")}
          />
          <p className="pt-2 text-xs text-ink/60 dark:text-parchment/60">These apply to every device you turned notifications on for.</p>
        </fieldset>
      )}
    </div>
  );
}

function Toggle({ label, note, checked, onChange }: { label: string; note: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg py-2">
      <span>
        <span className="block text-sm text-ink dark:text-parchment">{label}</span>
        <span className="block text-xs text-ink/60 dark:text-parchment/60">{note}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-growth-500 ${
          checked ? "bg-growth-600" : "bg-canopy-900/20 dark:bg-white/20"
        }`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </label>
  );
}
