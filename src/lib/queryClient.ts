import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

const PERSIST_KEY = "growell_query_cache";
const OWNER_KEY = "growell_cache_owner";
const DAY = 24 * 60 * 60 * 1000;
const CACHE_VERSION = "v4";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data counts as fresh for 2 minutes, so switching between Home,
      // Fields and Alerts shows cached data instantly instead of
      // re-fetching every time. After that it still shows the cached
      // copy first and refreshes quietly in the background.
      staleTime: 2 * 60 * 1000,
      // Must be at least as long as the persist maxAge below.
      gcTime: DAY,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Saves the cache to the browser, so reopening the app on a slow
 *  connection shows the last data straight away while fresh data loads. */
export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: PERSIST_KEY,
  throttleTime: 1000,
});
export const persistOptions = {
  persister,
  maxAge: DAY,
  // Bump this whenever the SHAPE of any cached data changes (a new field, a
  // renamed field). Saved data with a different version is thrown away
  // instead of being trusted, so old saved data can never crash new code.
  buster: CACHE_VERSION,
  dehydrateOptions: {
    // Only successful data is saved. The temporary "history is loading"
    // flag is never saved, or it could get stuck after a reload.
    shouldDehydrateQuery: (q: { state: { status: string }; queryKey: readonly unknown[] }) =>
      q.state.status === "success" &&
      q.queryKey[0] !== "backfill" &&
      q.queryKey[0] !== "frame" &&
      // Admin data covers every user. It is never written to the browser's
      // storage, and the admin check is always asked fresh.
      q.queryKey[0] !== "admin" &&
      q.queryKey[0] !== "isAdmin" &&
      q.queryKey[0] !== "terms",
  },
};

/** Reads the signed-in user's id from Supabase's own stored session,
 *  synchronously, so we can decide before anything renders whether the
 *  saved cache belongs to this person. */
function storedUserId(): string | null {
  // The auth session itself now lives in sessionStorage (see
  // lib/supabase.ts) — this has to look in the same place, or every tab
  // would wrongly conclude "nobody is signed in" and wipe a valid cache.
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
        return JSON.parse(sessionStorage.getItem(k) ?? "null")?.user?.id ?? null;
      }
    }
  } catch {
    // unreadable storage: treat as no user
  }
  return null;
}

// Runs once at startup, BEFORE the saved cache is loaded. If the saved
// cache belongs to someone else (or nobody is signed in), throw it away.
{
  const owner = localStorage.getItem(OWNER_KEY);
  if (owner && owner !== storedUserId()) {
    localStorage.removeItem(PERSIST_KEY);
    localStorage.removeItem(OWNER_KEY);
  }
}

export function claimCacheFor(userId: string) {
  localStorage.setItem(OWNER_KEY, userId);
}

/** Call on sign out: nothing from this account may be left behind. */
export function clearCache() {
  queryClient.clear();
  localStorage.removeItem(PERSIST_KEY);
  localStorage.removeItem(OWNER_KEY);
}

/** Call after adding/deleting a field or finishing a history load. */
export function refreshFarmData() {
  queryClient.invalidateQueries({ queryKey: ["fields"] });
  queryClient.invalidateQueries({ queryKey: ["snapshots"] });
  queryClient.invalidateQueries({ queryKey: ["alerts"] });
  queryClient.invalidateQueries({ queryKey: ["fieldDetail"] });
}
