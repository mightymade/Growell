import { useEffect, useRef, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/**
 * A thin bar along the top edge while data refreshes in the background.
 * The content already on screen stays put; this just says "updating".
 * Waits 300ms so quick refreshes never show it.
 */
export function RefreshBar() {
  const fetching = useIsFetching() > 0;
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!fetching) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, [fetching]);
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[1200] h-0.5 overflow-hidden transition-opacity duration-pop ${show ? "opacity-100" : "opacity-0"}`}
      role="progressbar"
      aria-hidden={!show}
      aria-label="Updating"
    >
      <div className="m-progress h-full w-1/2 bg-growth-500" />
    </div>
  );
}

/**
 * Slim banner when the device goes offline, and a short "Back online" note
 * when it reconnects. Announced to screen readers.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const [backOnline, setBackOnline] = useState(false);
  const wasOffline = useRef(!online);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setBackOnline(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setBackOnline(true);
    const t = setTimeout(() => setBackOnline(false), 3000);
    return () => clearTimeout(t);
  }, [online]);

  return (
    <div aria-live="polite">
      {!online && (
        <div className="m-in flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-sm text-parchment dark:bg-white/10">
          <span className="h-2 w-2 rounded-full bg-laterite-600" aria-hidden />
          You're offline. Showing your last saved data.
        </div>
      )}
      {backOnline && (
        <div className="m-in flex items-center justify-center gap-2 bg-growth-600 px-4 py-2 text-center text-sm font-medium text-white">
          Back online.
        </div>
      )}
    </div>
  );
}
