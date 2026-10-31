import { supabase } from "../supabase";

export type LogoutReason = "button" | "idle" | "deactivated";

/**
 * Records a log in or log out in the admin audit trail. The database
 * decides who the event belongs to (the signed-in user), so this can't be
 * used to log on someone else's behalf. Never throws: a missing patch or a
 * bad connection must never stop someone logging in or out.
 */
export async function logAuthEvent(action: "auth.login" | "auth.logout", reason?: LogoutReason): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_auth_event", { p_action: action, p_reason: reason ?? null });
    if (error) console.warn(`Could not record ${action}: ${error.message}`);
  } catch (err) {
    console.warn(`Could not record ${action}:`, err);
  }
}

/** Every log out goes through here, so each one is recorded. Logging is
 *  given at most 2 seconds; signing out always happens. */
export async function signOutAndLog(reason: LogoutReason = "button") {
  await Promise.race([logAuthEvent("auth.logout", reason), new Promise((r) => setTimeout(r, 2000))]);
  return supabase.auth.signOut();
}
