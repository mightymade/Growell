// Backfills a newly-added field with historical NDVI + weather data, so
// its chart shows months of real satellite history immediately instead
// of an empty graph that only fills in day by day. Sentinel-2 has flown
// since 2015 and Copernicus keeps the archive — there's no reason to
// wait when the data already exists.
//
// Deliberately does NOT run anomaly detection or generate alerts for
// backfilled days — alerts should always mean "just detected," not
// "detected months ago." The very next daily-pipeline run does real
// anomaly detection using this newly-populated history as its baseline.
//
// Called automatically right after a field is saved (see AddField.tsx),
// but safe to call again manually for an existing field — upserts mean
// no duplicates.
//
// Deploy: supabase functions deploy backfill-field --no-verify-jwt
// (no-verify-jwt: called directly from the logged-in farmer's browser
// with their own session, not a service-role cron job like daily-pipeline)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchNdviTimeSeries, polygonCentroid } from "../_shared/sentinel.ts";
import { fetchWeatherHistory } from "../_shared/weather.ts";
import { saveNdviReadings, saveWeatherReadings } from "../_shared/store.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const BACKFILL_DAYS = 90; // Open-Meteo's own cap on `past_days` is 92
const CLOUD_COVER_LIMIT = 40; // same limit as daily-pipeline

// The web app calls this function straight from the browser. A browser
// first sends an OPTIONS "preflight" request and refuses to make the real
// call unless the answer allows it. Without these headers every call from
// AddField.tsx failed silently, so new fields never got their 90 days.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let fieldId: string;
  try {
    const body = await req.json();
    fieldId = body.field_id;
    if (!fieldId) throw new Error("missing field_id");
  } catch {
    return json({ error: "Expected JSON body: { field_id: string }" }, 400);
  }

  // Only the field's owner may start a download for it. The field is read
  // AS the signed-in farmer, so row level security decides: someone else's
  // field id, a deleted field, or no session at all is simply not found.
  // Without this, anyone could call this public function with any field id
  // and use up the satellite quota.
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: owned } = await asUser.from("fields").select("id").eq("id", fieldId).maybeSingle();
  if (!owned) return json({ error: "Field not found" }, 404);

  const { data: field, error: fieldError } = await supabase
    .from("fields")
    .select("id, field_name, boundary_coords, area_hectares")
    .eq("id", fieldId)
    .is("deleted_at", null)
    .single();

  if (fieldError || !field) {
    return json({ error: fieldError?.message ?? "Field not found" }, 404);
  }

  const to = new Date();
  const from = new Date(to.getTime() - BACKFILL_DAYS * 24 * 60 * 60 * 1000);

  let ndviResult: Awaited<ReturnType<typeof fetchNdviTimeSeries>> = { readings: [], skipped: [], approximate: false };
  let ndviError: string | null = null;
  try {
    ndviResult = await fetchNdviTimeSeries(field.boundary_coords, from, to, field.area_hectares);
  } catch (err) {
    ndviError = (err as Error).message;
  }
  const ndviReadings = ndviResult.readings;

  let weatherReadings: Awaited<ReturnType<typeof fetchWeatherHistory>> = [];
  let weatherError: string | null = null;
  try {
    const { lat, lon } = polygonCentroid(field.boundary_coords);
    weatherReadings = await fetchWeatherHistory(lat, lon, BACKFILL_DAYS);
  } catch (err) {
    weatherError = (err as Error).message;
  }

  // Same cloud limit as the daily job, so the chart never shows a reading
  // the daily job would have thrown away.
  const usable = ndviReadings.filter((r) => r.cloudCoverPct <= CLOUD_COVER_LIMIT);
  const ndviSave = await saveNdviReadings(supabase, field.id, usable, ndviResult.approximate);
  const weatherSave = await saveWeatherReadings(supabase, field.id, weatherReadings);

  return json({
      field: field.field_name,
      area_hectares: field.area_hectares,
      ndvi_days_found: ndviReadings.length,
      ndvi_days_saved: ndviSave.saved,
      ndvi_too_cloudy: ndviReadings.length - usable.length,
      ndvi_save_error: ndviSave.error,
      ndvi_save_warning: ndviSave.warning,
      weather_days_saved: weatherSave.saved,
      weather_save_error: weatherSave.error,
      // True if the exact drawn boundary returned nothing and a small-field
      // centroid fallback was used instead — see satellite_images.is_approximate.
      ndvi_approximate: ndviResult.approximate,
      // Per-date reasons a pass didn't produce a reading (no_samples = fully
      // masked out, nan_mean = pixels counted but the average was still
      // undefined) — useful when ndvi_days_found is 0 and you want to know
      // why, instead of just that it's zero. Re-run this function manually
      // against a field to see this for real (see this file's header).
      ndvi_skipped: ndviResult.skipped,
      weather_days_found: weatherReadings.length,
      ndvi_error: ndviError,
      weather_error: weatherError,
  });
});
