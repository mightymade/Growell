import { supabase } from "../supabase";
import { toFriendlyError } from "../apiError";
import { logAuthEvent } from "./audit";
import { acceptTerms } from "./legal";
import { TERMS_VERSION } from "../legal";

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw toFriendlyError(error);
  // Logged here, right after a real sign in, and not on onAuthStateChange,
  // which also fires when a saved session is restored.
  await logAuthEvent("auth.login");
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw toFriendlyError(error);
}

export type SignUpInput = { email: string; password: string; name: string };
export type SignUpResult = { userId: string; needsConfirmation: boolean };

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    // The Terms version and time are saved with the account, so the
    // agreement is on record even before the email is confirmed.
    options: { data: { name: input.name.trim(), terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() } },
  });
  if (error) throw toFriendlyError(error);
  if (!data.user) throw toFriendlyError(null, "Something went wrong creating your account. Please try again.");
  // Accounts that don't need email confirmation are signed in straight away.
  if (data.session) {
    await logAuthEvent("auth.login");
    await acceptTerms().catch(() => {});
  }
  return { userId: data.user.id, needsConfirmation: !data.session };
}
