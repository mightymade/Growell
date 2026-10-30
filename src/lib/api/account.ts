import { supabase } from "../supabase";
import { toFriendlyError, unwrap } from "../apiError";
import { uploadAvatar, validateAvatarFile } from "../avatar";
import type { FarmerProfile } from "../../hooks/useFarmerProfile";

export async function fetchProfile(): Promise<FarmerProfile | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;

  const res = await supabase
    .from("farmers")
    .select("id, name, phone_number, location, avatar_url, is_active, date_registered")
    .eq("id", user.id)
    .single();
  const data = unwrap(res);

  return {
    id: user.id,
    name: data?.name ?? user.email ?? "Farmer",
    email: user.email ?? "",
    phone_number: data?.phone_number ?? null,
    location: data?.location ?? null,
    avatar_url: data?.avatar_url ?? null,
    is_active: data?.is_active ?? true,
    date_registered: data?.date_registered ?? "",
  };
}

export type ProfileUpdate = { name: string; phone: string; location: string };

/** RLS (`farmers read/update own row`) restricts this to the signed-in
 *  farmer's own row — the .eq() narrows the query, RLS is the backstop. */
export async function updateProfile(farmerId: string, update: ProfileUpdate): Promise<void> {
  const { error } = await supabase
    .from("farmers")
    .update({ name: update.name.trim(), phone_number: update.phone.trim(), location: update.location.trim() })
    .eq("id", farmerId);
  if (error) throw toFriendlyError(error, "Couldn't save your profile. Please try again.");
}

/** Supabase requires a fresh confirmation from the new address before this
 *  takes effect — it does not change instantly. */
export async function requestEmailChange(newEmail: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
  if (error) throw toFriendlyError(error);
}

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw toFriendlyError(error);
}

export async function setAccountActive(farmerId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("farmers").update({ is_active: active }).eq("id", farmerId);
  if (error) throw toFriendlyError(error, active ? "Couldn't reactivate your account." : "Couldn't deactivate your account.");
}

export async function changeProfilePhoto(file: File, farmerId: string): Promise<string> {
  const validationError = validateAvatarFile(file);
  if (validationError) throw new Error(validationError);
  const avatarUrl = await uploadAvatar(file, farmerId);
  const { error } = await supabase.from("farmers").update({ avatar_url: avatarUrl }).eq("id", farmerId);
  if (error) throw toFriendlyError(error, "Photo uploaded, but couldn't be saved to your profile.");
  return avatarUrl;
}
