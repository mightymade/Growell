import { supabase } from "./supabase";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Use a JPG, PNG, or WEBP image.";
  if (file.size > MAX_SIZE_BYTES) return "Image must be under 2MB.";
  return null;
}

/**
 * Uploads to a fixed path per user ({user_id}/avatar.{ext}) so re-uploading
 * overwrites the old file instead of accumulating versions — `upsert:true`
 * handles that. Because the path never changes, a plain public URL would
 * otherwise get stuck showing a cached copy of the old image after a
 * re-upload; appending a cache-busting query param forces a fresh fetch.
 */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
