import { queryClient, refreshFarmData } from "./queryClient";
import { supabase } from "./supabase";

/**
 * Loads a field's satellite and weather history IN THE BACKGROUND: the
 * last 90 days, or back to a week before planting when that is further
 * (up to a year). Used for a new field and when a planting date moves. It used to block the Add Field screen until Sentinel Hub
 * answered, which could take a long time. Now the farmer goes straight to
 * the new field, sees a "loading history" note, and the charts fill in the
 * moment the history arrives.
 */
export function startBackfill(fieldId: string) {
  queryClient.setQueryData(["backfill", fieldId], true);
  supabase.functions
    .invoke("backfill-field", { body: { field_id: fieldId, full: true } })
    .then(({ data, error }) => {
      // Logged so a failed first download is visible in the console instead
      // of silent. Non-fatal: the daily job now repairs fields with no history.
      if (error) console.error("backfill-field failed", error);
      else console.info("backfill-field result", data);
    })
    .catch((err) => console.error("backfill-field failed", err))
    .finally(() => {
      queryClient.setQueryData(["backfill", fieldId], false);
      refreshFarmData();
    });
}

/**
 * True when a new planting date means the field needs history from
 * further back than it has: the week before planting falls outside the
 * last 90 days, and it is earlier than the old planting date.
 */
export function needsOlderHistory(newDate: string, oldDate: string | null): boolean {
  if (oldDate && newDate >= oldDate) return false;
  const weekBefore = new Date(`${newDate}T00:00:00Z`).getTime() - 7 * 86_400_000;
  return weekBefore < Date.now() - 90 * 86_400_000;
}

type BackfillResponse = {
  ndvi_days_found?: number;
  ndvi_days_saved?: number;
  ndvi_too_cloudy?: number;
  ndvi_approximate?: boolean;
  ndvi_older_image?: string | null;
  ndvi_error?: string | null;
  ndvi_save_error?: string | null;
  ndvi_save_warning?: string | null;
  weather_days_saved?: number;
  weather_error?: string | null;
  weather_save_error?: string | null;
  error?: string;
};

/**
 * ok: something new was saved. failed: the check itself broke (network,
 * service down, saving refused) and is worth trying again. A check that
 * worked but found only cloudy passes is neither ok nor failed.
 */
export type RefreshOutcome = { ok: boolean; failed: boolean; message: string };

/**
 * Pulls the last 90 days again for one field and says what happened in
 * plain words. Safe to run any time: saving is an upsert, so nothing is
 * doubled. This is the "fix it now" button for a field whose first
 * history download failed.
 */
export async function refreshFieldData(fieldId: string): Promise<RefreshOutcome> {
  queryClient.setQueryData(["backfill", fieldId], true);
  try {
    let data: BackfillResponse | null = null;
    let error: unknown = null;
    try {
      ({ data, error } = await supabase.functions.invoke<BackfillResponse>("backfill-field", {
        body: { field_id: fieldId },
      }));
    } catch (err) {
      error = err;
    }
    if (error) {
      console.error(error);
      return { ok: false, failed: true, message: "Couldn't reach the satellite service." };
    }
    const r = data ?? {};
    console.info("backfill-field result", r);
    if (r.error) return { ok: false, failed: true, message: r.error };
    if (r.ndvi_error) return { ok: false, failed: true, message: `Satellite request failed: ${r.ndvi_error}` };
    if (r.ndvi_save_error) return { ok: false, failed: true, message: `Readings found but not saved: ${r.ndvi_save_error}` };

    const saved = r.ndvi_days_saved ?? 0;
    const cloudy = r.ndvi_too_cloudy ?? 0;
    const weather = r.weather_days_saved ?? 0;
    const parts: string[] = [];
    if (r.ndvi_older_image) {
      parts.push(`no clear image in the last 90 days, so the latest clear one (${r.ndvi_older_image}) was saved`);
    } else if (saved > 0) {
      parts.push(`${saved} clear image${saved === 1 ? "" : "s"} saved`);
    } else if (cloudy > 0) {
      parts.push(`${cloudy} pass${cloudy === 1 ? " was" : "es were"} found, but all too cloudy to use`);
    } else {
      parts.push("no satellite passes found in the last 90 days");
    }
    if (cloudy > 0 && saved > 0) parts.push(`${cloudy} skipped for cloud`);
    parts.push(`${weather} days of weather`);
    if (r.ndvi_approximate) parts.push("readings are approximate because the field is small");
    return { ok: saved > 0 || weather > 0, failed: false, message: parts.join(", ") + "." };
  } finally {
    queryClient.setQueryData(["backfill", fieldId], false);
    refreshFarmData();
  }
}
