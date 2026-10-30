import { BusyLabel } from "./Busy";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { setAccountActive } from "../lib/api/account";

/**
 * Shown instead of the whole app when the farmer has deactivated their
 * own account. Self-service reactivation — there's no admin/support
 * system behind this app, so a dead-end here would strand them for
 * real. Reactivating is just flipping the same flag back.
 */
export default function DeactivatedGate({ onReactivated }: { onReactivated: () => void }) {
  const [reactivating, setReactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReactivate() {
    setReactivating(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Your session has expired. Please log in again.");
      await setAccountActive(userData.user.id, true);
      onReactivated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reactivate your account. Please try again.");
    } finally {
      setReactivating(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-parchment dark:bg-night-950 p-6">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-night-900 p-7 text-center shadow-e3">
        <img src="/logo.svg" alt="" className="mx-auto mb-4 h-10 w-10" />
        <h1 className="font-display text-lg font-bold text-ink dark:text-parchment">Your account is deactivated</h1>
        <p className="mt-2 text-sm text-ink/70 dark:text-parchment/70">
          Your fields and data are all still here. Reactivate to see them again.
        </p>
        <button
          onClick={handleReactivate}
          disabled={reactivating}
          className="mt-6 w-full rounded-lg bg-growth-600 py-3 text-sm font-semibold text-white hover:bg-growth-600/90 disabled:opacity-50"
        >
          <BusyLabel busy={reactivating} label="Reactivate my account" busyLabel="Reactivating…" />
        </button>
        {error && <p role="alert" className="mt-3 text-xs text-laterite-700">{error}</p>}
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-3 text-sm font-medium text-ink/70 dark:text-parchment/70 hover:text-ink dark:hover:text-parchment"
        >
          Sign out instead
        </button>
      </div>
    </div>
  );
}
