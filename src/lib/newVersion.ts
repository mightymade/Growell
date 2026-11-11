/**
 * After a new version of Growell goes live, a tab that was already open
 * still asks for the OLD code files, which no longer exist (404). Instead of
 * showing "Something went wrong", reload once so the tab gets the new
 * version. Guarded so a real outage can't cause an endless reload loop.
 */
const KEY = "growell_new_version_reload";
const GUARD_MS = 30_000;
// Set once a reload has started, so every later catch of the same failure
// shows the loading screen instead of an error while the page reloads.
let reloading = false;

export function isOldVersionError(error: unknown): boolean {
  const msg = String((error as { message?: unknown })?.message ?? error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
    msg,
  );
}

/** Reloads the page, unless it already did so in the last 30 seconds. Returns true if it reloads. */
export function reloadForNewVersion(): boolean {
  if (reloading) return true;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < GUARD_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage blocked: reload anyway, once per page load */
  }
  reloading = true;
  window.location.reload();
  return true;
}

/** Catches the same failure outside React (preloads and unhandled imports). */
export function watchForNewVersion() {
  // Not preventDefault(): the import must still fail, so the page that
  // needed it shows the loading screen (see ErrorBoundary) rather than
  // crashing on an empty module while the reload starts.
  window.addEventListener("vite:preloadError", () => {
    reloadForNewVersion();
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isOldVersionError(event.reason) && reloadForNewVersion()) event.preventDefault();
  });
}
