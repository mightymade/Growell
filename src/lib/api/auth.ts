import { supabase } from "../supabase";
import { toFriendlyError } from "../apiError";

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw toFriendlyError(error);
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
    options: { data: { name: input.name.trim() } },
  });
  if (error) throw toFriendlyError(error);
  if (!data.user) throw toFriendlyError(null, "Something went wrong creating your account. Please try again.");
  return { userId: data.user.id, needsConfirmation: !data.session };
}
