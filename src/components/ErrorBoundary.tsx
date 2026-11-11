import { Component, type ReactNode } from "react";
import { clearCache } from "../lib/queryClient";
import { isOldVersionError, reloadForNewVersion } from "../lib/newVersion";
import Splash from "../pages/Splash";

/** The calm screen shown instead of a blank page if something crashes. */
export function ErrorFallback({ onReload }: { onReload: () => void }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-parchment dark:bg-night-950 p-6">
      <div role="alert" className="w-full max-w-sm rounded-xl bg-white dark:bg-night-900 p-7 text-center shadow-e3">
        <h1 className="font-display text-lg font-bold text-ink dark:text-parchment">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink/70 dark:text-parchment/70">
          Growell hit a problem while loading this screen. Your fields and data are safe. Reloading usually fixes it.
        </p>
        <button
          onClick={onReload}
          className="mt-6 w-full rounded-lg bg-growth-600 py-3 text-sm font-semibold text-white hover:bg-growth-600/90"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

/** updating: the crash was this tab missing a new version, and it is reloading. */
type State = { failed: boolean; updating: boolean };

/**
 * Catches a crash anywhere below it. Reloading also clears the saved copy
 * of the data, because a bad saved copy is the most likely cause of a crash
 * that keeps happening on every load.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, updating: false };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, updating: isOldVersionError(error) };
  }

  componentDidCatch(error: unknown) {
    if (isOldVersionError(error)) {
      console.info("A new version of Growell is live. Reloading to get it.");
      // Reloaded very recently already: it is a real outage, so show the message.
      if (!reloadForNewVersion()) this.setState({ updating: false });
      return;
    }
    console.error("Growell crashed:", error);
  }

  private reload = () => {
    clearCache();
    window.location.reload();
  };

  render() {
    if (this.state.failed && this.state.updating) return <Splash />;
    return this.state.failed ? <ErrorFallback onReload={this.reload} /> : this.props.children;
  }
}
