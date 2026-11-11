// Fills a field with past crop health and weather, so its chart shows
// real satellite history straight away instead of filling in day by day.
// Sentinel-2 has flown since 2015 and Copernicus keeps the archive.
//
// How far back:
// - { field_id }                 the last 90 days (the once-per-login check)
// - { field_id, full: true }     also back to a week before the planting date,
//                                up to a year (a new field, or a planting
//                                date moved earlier)
// If that window has no clear image at all, the newest clear image from
// the past year is saved, so the chart is never left empty.
//
// Deliberately does NOT run anomaly detection or generate alerts for
// backfilled days — alerts should always mean "just detected," not
// "detected months ago." The very next daily-pipeline run does real
// anomaly detection using this newly-populated history as its baseline.
//
// Called automatically right after a field is saved (see AddField.tsx) and
// when its planting date changes (GrowthStageCard.tsx),
// but safe to call again manually for an existing field — upserts mean
// no duplicates.
//
// Deploy: supabase functions deploy backfill-field --no-verify-jwt
// (no-verify-jwt: called directly from the logged-in farmer's browser
// with their own session, not a service-role cron job like daily-pipeline)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchNdviTimeSeries, polygonCentroid } from "../_shared/sentinel.ts";
import { fetchWeatherRange } from "../_shared/weather.ts";
import { saveNdviReadings, saveWeatherReadings } from "../_shared/store.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const DAY = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 90; // the usual window: the last 90 days
const MAX_DAYS = 365; // never pull more than a year, to protect the satellite quota
const BEFORE_PLANTING_DAYS = 7; // a week before planting shows the ground as it was
const CLOUD_COVER_LIMIT = 40; // same limit as daily-pipeline

/**
 * The first day to pull. Normally 90 days back. With full=true (a new
 * field, or a planting date that was moved earlier) it goes back to a
 * week before planting when that is further, up to a year.
 */
function windowStart(today: Date, plantedDate: string | null, full: boolean): Date {
  let start = today.getTime() - RECENT_DAYS * DAY;
  if (full && plantedDate) {
    const planted = new Date(`${plantedDate}T00:00:00Z`).getTime();
    if (Number.isFinite(planted)) start = Math.min(start, planted - BEFORE_PLANTING_DAYS * DAY);
  }
  return new Date(Math.max(start, today.getTime() - MAX_DAYS * DAY));
}

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
  let full = false;
  try {
    const body = await req.json();
    fieldId = body.field_id;
    full = body.full === true;
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
    .select("id, field_name, boundary_coords, area_hectares, planted_date")
    .eq("id", fieldId)
    .is("deleted_at", null)
    .single();

  if (fieldError || !field) {
    return json({ error: fieldError?.message ?? "Field not found" }, 404);
  }

  const to = new Date();
  const from = windowStart(to, field.planted_date ?? null, full);

  let ndviResult: Awaited<ReturnType<typeof fetchNdviTimeSeries>> = { readings: [], skipped: [], approximate: false };
  let ndviError: string | null = null;
  try {
    ndviResult = await fetchNdviTimeSeries(field.boundary_coords, from, to, field.area_hectares);
  } catch (err) {
    ndviError = (err as Error).message;
  }
  const ndviReadings = ndviResult.readings;

  let weatherReadings: Awaited<ReturnType<typeof fetchWeatherRange>> = [];
  let weatherError: string | null = null;
  try {
    const { lat, lon } = polygonCentroid(field.boundary_coords);
    weatherReadings = await fetchWeatherRange(lat, lon, from, to);
  } catch (err) {
    weatherError = (err as Error).message;
  }

  // Same cloud limit as the daily job, so the chart never shows a reading
  // the daily job would have thrown away.
  const usable = ndviReadings.filter((r) => r.cloudCoverPct <= CLOUD_COVER_LIMIT);

  // Nothing clear in the window (common in the rainy season): look further
  // back, up to a year, and keep only the newest clear image, so the farmer
  // sees the latest known health instead of an empty chart.
  let olderImage: string | null = null;
  const yearAgo = new Date(to.getTime() - MAX_DAYS * DAY);
  if (!ndviError && usable.length === 0 && from > yearAgo) {
    try {
      const older = await fetchNdviTimeSeries(field.boundary_coords, yearAgo, from, field.area_hectares);
      const clear = older.readings.filter((r) => r.cloudCoverPct <= CLOUD_COVER_LIMIT).sort((a, b) => a.date.localeCompare(b.date));
      const newest = clear[clear.length - 1];
      if (newest) {
        usable.push(newest);
        olderImage = newest.date;
        ndviResult.approximate = ndviResult.approximate || older.approximate;
      }
    } catch (err) {
      console.error("older image search failed", err);
    }
  }
  const ndviSave = await saveNdviReadings(supabase, field.id, usable, ndviResult.approximate);
  const weatherSave = await saveWeatherReadings(supabase, field.id, weatherReadings);

  return json({
      field: field.field_name,
      area_hectares: field.area_hectares,
      from: from.toISOString().slice(0, 10),
      // Set when the window had no clear image and an older one was used.
      ndvi_older_image: olderImage,
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
