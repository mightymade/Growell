import { supabase } from "../supabase";
import { TERMS_VERSION } from "../legal";

const MISSING = new Set(["PGRST202", "42883", "42703", "PGRST204"]);

/** Records that the signed-in farmer accepted this version of the Terms and Privacy Policy. */
export async function acceptTerms(acceptedAt?: string): Promise<void> {
  const { error } = await supabase.rpc("accept_terms", { p_version: TERMS_VERSION, p_accepted_at: acceptedAt ?? null });
  if (error && !MISSING.has(error.code)) throw new Error("Couldn't save your agreement. Please try again.");
}

/**
 * Which version this farmer last accepted. Returns the current version when
 * the database doesn't have the consent columns yet (before patch_011), so
 * nobody is blocked by a missing patch.
 */
export async function acceptedTermsVersion(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("farmers").select("terms_version").eq("id", userId).maybeSingle();
  if (error) {
    if (MISSING.has(error.code)) return TERMS_VERSION;
    throw error;
  }
  return (data as { terms_version: string | null } | null)?.terms_version ?? null;
}
