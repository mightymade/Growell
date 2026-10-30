import { useEffect, useState } from "react";

/**
 * Tracks real browser connectivity via the online/offline events, so the
 * app can distinguish "you have no internet" from "you genuinely have no
 * fields yet" — without this, a failed Supabase fetch while offline just
 * leaves `fields` as an empty array, and the dashboard shows the same
 * empty state either way, which is actively misleading.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
