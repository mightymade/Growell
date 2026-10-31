import { signOutAndLog } from "../lib/api/audit";
import { useCallback, useEffect, useRef, useState } from "react";

const IDLE_LIMIT_MS = 20 * 60 * 1000; // 20 minutes
const WARNING_BEFORE_MS = 60 * 1000; // warn 60s before it happens
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "touchstart", "wheel", "scroll"] as const;
const BROADCAST_KEY = "growell_last_activity";

/**
 * Signs the farmer out after 20 minutes with no real interaction —
 * mouse, keyboard, touch or scroll, not just the tab being open. Shows a
 * 60-second warning first with a "stay signed in" option, rather than
 * logging out silently mid-task.
 *
 * Activity in ANY open tab resets the clock in all of them (via a
 * localStorage broadcast) — otherwise switching to read something in a
 * second tab would let the first one time out from under you.
 */
export function useIdleLogout() {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const warnTimer = useRef<ReturnType<typeof setTimeout>>();
  const logoutTimer = useRef<ReturnType<typeof setTimeout>>();
  const tickTimer = useRef<ReturnType<typeof setInterval>>();

  const clearTimers = () => {
    clearTimeout(warnTimer.current);
    clearTimeout(logoutTimer.current);
    clearInterval(tickTimer.current);
  };

  const schedule = useCallback(() => {
    clearTimers();
    setWarning(false);
    warnTimer.current = setTimeout(() => {
      setWarning(true);
      setSecondsLeft(Math.round(WARNING_BEFORE_MS / 1000));
      tickTimer.current = setInterval(() => {
        setSecondsLeft((s) => Math.max(0, s - 1));
      }, 1000);
    }, IDLE_LIMIT_MS - WARNING_BEFORE_MS);
    logoutTimer.current = setTimeout(() => {
      signOutAndLog("idle");
    }, IDLE_LIMIT_MS);
  }, []);

  const recordActivity = useCallback(
    (broadcast: boolean) => {
      schedule();
      if (broadcast) {
        try {
          localStorage.setItem(BROADCAST_KEY, String(Date.now()));
        } catch {
          // ignore — worst case, activity in another tab doesn't reset this one
        }
      }
    },
    [schedule],
  );

  useEffect(() => {
    let lastRecorded = 0;
    // Throttled: activity events fire constantly (mousemove especially) —
    // no need to reset the timer more than a few times a second.
    const handler = () => {
      const now = Date.now();
      if (now - lastRecorded < 1000) return;
      lastRecorded = now;
      recordActivity(true);
    };
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, handler, { passive: true });

    function onStorage(e: StorageEvent) {
      if (e.key === BROADCAST_KEY) recordActivity(false);
    }
    window.addEventListener("storage", onStorage);

    recordActivity(false);

    return () => {
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, handler);
      window.removeEventListener("storage", onStorage);
      clearTimers();
    };
  }, [recordActivity]);

  useEffect(() => {
    if (warning && secondsLeft === 0) signOutAndLog("idle");
  }, [warning, secondsLeft]);

  return {
    warning,
    secondsLeft,
    staySignedIn: () => recordActivity(true),
  };
}
