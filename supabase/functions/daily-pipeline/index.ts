// Daily pipeline Edge Function.
// Runs the six-step process from the System Design Document:
//   1. Data Ingestion   2. Pre-processing   3. Anomaly Detection
//   4. Cause Inference  5. Recommendation   6. Alert Generation
//
// Deploy:   supabase functions deploy daily-pipeline --no-verify-jwt
// Schedule: pg_cron calls it daily with the secret key header
//           x-pipeline-key (see supabase/patch_011_legal_security_accuracy.sql)
// (--no-verify-jwt: this runs as a scheduled/service job, not on behalf
// of a logged-in user, so there's no user JWT to verify.)
//
// REQUIRES two secrets to actually fetch real satellite data — see
// supabase/SENTINEL_SETUP.md for the one-time setup.
//
// New fields get their history filled in immediately by backfill-field
// (see AddField.tsx) — this function only looks at a short recent
// window, since its job is "what changed since yesterday," not history.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchNdviTimeSeries, polygonCentroid } from "../_shared/sentinel.ts";
import { fetchWeatherHistory } from "../_shared/weather.ts";
import { computeGrowthStage } from "../_shared/cropStages.ts";
import { notifyFarmer } from "../_shared/notify.ts";
import { saveNdviReadings, saveWeatherReadings } from "../_shared/store.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // service role: bypasses RLS, server-side only
);

const DROP_THRESHOLD_PCT = 15; // flag an anomaly if NDVI falls >15% below baseline
const CLOUD_COVER_LIMIT = 40; // % — skip images cloudier than this
const LOOKBACK_DAYS = 10; // how far back to search for the most recent usable Sentinel-2 pass
// A field with no saved history at all gets a full 90-day pull instead.
// This repairs fields whose first backfill failed, without anyone having
// to notice and re-run it by hand.
const HEAL_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

type Field = {
  id: string;
  field_name: string;
  boundary_coords: GeoJSON.Polygon;
  crop_type: string | null;
  planted_date: string | null;
  farmer_id: string;
  /** Days to harvest for a crop that isn't on the list (patch_012). */
  maturity_days?: number | null;
  area_hectares: number | null;
};

// ---- Step 4: Cause Inference (simple rule-based stand-in) ------------------
function inferCause(rainfallMm: number) {
  if (rainfallMm < 3) return { cause: "drought", confidence: 80 };
  if (rainfallMm > 12) return { cause: "excess_rainfall", confidence: 75 };
  return { cause: "pest_disease", confidence: 55 };
}

/** How each cause reads in an alert. */
const CAUSE_WORDS: Record<string, string> = {
  drought: "drought stress",
  excess_rainfall: "too much water",
  pest_disease: "pest or disease",
};

// ---- Step 5: Recommendation Engine ------------------------------------------
function recommend(cause: string): string {
  switch (cause) {
    case "drought":
      return "Very little rain has fallen. Water the field early in the morning or in the evening if you can, and mulch to keep the soil moist.";
    case "excess_rainfall":
      return "There has been a lot of rain. Clear drainage channels so water does not stand in the field.";
    case "pest_disease":
      return "The weather does not explain this drop. Walk the field and check the leaves for spots, holes or insects.";
    default:
      return "Check the field over the next few days.";
  }
}

/**
 * Records a pipeline event in the admin audit trail (patch_010). Never
 * stops the run: if the patch isn't installed yet, it only logs a warning.
 */
async function logEvent(action: "pipeline.check_failed" | "pipeline.run_finished", details: Record<string, unknown>, field?: Field) {
  const { error } = await supabase.rpc("log_system_event", {
    p_action: action,
    p_entity_id: field?.id ?? null,
    p_entity_name: field?.field_name ?? null,
    p_details: details,
  });
  if (error) console.warn(`could not record ${action}: ${error.message}`);
}

/** Constant-time compare, so the key can't be guessed one letter at a time. */
function sameKey(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  // The function's address is public, so only a caller that knows the
  // secret key may start a run: the daily schedule sends it (see
  // patch_011). Anyone else is refused before any satellite quota is used.
  const expected = Deno.env.get("PIPELINE_KEY") ?? "";
  if (!expected) {
    return new Response(JSON.stringify({ error: "PIPELINE_KEY is not set. See patch_011 setup steps." }), { status: 500 });
  }
  if (!sameKey(req.headers.get("x-pipeline-key") ?? "", expected)) {
    return new Response(JSON.stringify({ error: "Not allowed" }), { status: 401 });
  }
  const started = Date.now();
  // Deleted fields stay in the table for the admin's history (patch_010),
  // but are never checked again.
  const { data: fields, error } = await supabase
    .from("fields")
    // "*" so a database without patch_012's maturity_days still works.
    .select("*")
    .is("deleted_at", null);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const results: string[] = [];
  let newImages = 0;
  let failures = 0;
  let alertsCreated = 0;
  let pushesSent = 0;
  const failed = async (field: Field, reason: string) => {
    failures++;
    await logEvent("pipeline.check_failed", { reason: reason.slice(0, 300) }, field);
  };

  for (const field of (fields ?? []) as Field[]) {
    if (!field.boundary_coords) {
      results.push(`${field.field_name}: no boundary saved, skipped`);
      continue;
    }
    const to = new Date();
    const { lat, lon } = polygonCentroid(field.boundary_coords);

    // What does this field already have? Used to (a) pick a 90-day window
    // for a field with nothing saved yet, and (b) avoid creating the same
    // alert again for an image date that was already checked on an
    // earlier run. Sentinel-2 passes every few days, so the 10-day window
    // returns the same latest image on several runs in a row.
    const [{ count: ndviCount }, { count: weatherCount }, { data: knownRows }] = await Promise.all([
      supabase.from("satellite_images").select("id", { count: "exact", head: true }).eq("field_id", field.id),
      supabase.from("weather_records").select("id", { count: "exact", head: true }).eq("field_id", field.id),
      supabase
        .from("satellite_images")
        .select("capture_date")
        .eq("field_id", field.id)
        .gte("capture_date", new Date(to.getTime() - HEAL_DAYS * DAY_MS).toISOString().slice(0, 10)),
    ]);
    const knownDates = new Set((knownRows ?? []).map((r: { capture_date: string }) => r.capture_date));
    const ndviDays = (ndviCount ?? 0) === 0 ? HEAL_DAYS : LOOKBACK_DAYS;
    const weatherDays = (weatherCount ?? 0) === 0 ? HEAL_DAYS : LOOKBACK_DAYS;
    const notes: string[] = [];
    if (ndviDays === HEAL_DAYS) notes.push("no satellite history, pulled 90 days");
    if (weatherDays === HEAL_DAYS) notes.push("no weather history, pulled 90 days");

    // Weather first, and every day of the window, not only today. Today's
    // value is partly a forecast, so saving the whole window each run also
    // replaces yesterday's partial number with the final one.
    let weatherReadings: Awaited<ReturnType<typeof fetchWeatherHistory>> = [];
    try {
      weatherReadings = await fetchWeatherHistory(lat, lon, weatherDays);
      const w = await saveWeatherReadings(supabase, field.id, weatherReadings);
      if (w.error) notes.push(`weather save failed: ${w.error}`);
    } catch (err) {
      notes.push(`weather fetch failed: ${(err as Error).message}`);
    }

    // 1. Ingestion
    let ndviResult: Awaited<ReturnType<typeof fetchNdviTimeSeries>>;
    try {
      const from = new Date(to.getTime() - ndviDays * DAY_MS);
      ndviResult = await fetchNdviTimeSeries(field.boundary_coords, from, to, field.area_hectares);
    } catch (err) {
      results.push(`${field.field_name}: satellite fetch failed: ${(err as Error).message}${notes.length ? ` [${notes.join("; ")}]` : ""}`);
      await failed(field, `Satellite fetch failed: ${(err as Error).message}`);
      continue;
    }

    // 2. Pre-processing: keep EVERY clear-enough day in the window, not
    // just the newest one. The old code looked only at the newest day, so
    // one cloudy pass threw away a clear pass from three days earlier.
    const usable = ndviResult.readings.filter((r) => r.cloudCoverPct <= CLOUD_COVER_LIMIT);
    const tooCloudy = ndviResult.readings.length - usable.length;

    const saved = await saveNdviReadings(supabase, field.id, usable, ndviResult.approximate);
    if (saved.warning) notes.push(saved.warning);
    if (saved.error) {
      results.push(`${field.field_name}: could not save NDVI: ${saved.error}`);
      await failed(field, `Could not save the reading: ${saved.error}`);
      continue;
    }

    if (usable.length === 0) {
      const reasons = ndviResult.skipped.length > 0
        ? `; ${ndviResult.skipped.map((s) => `${s.date}=${s.reason}`).join(", ")}`
        : "";
      results.push(
        `${field.field_name}: no clear pass in the last ${ndviDays} days (${tooCloudy} too cloudy${reasons})` +
          (notes.length ? ` [${notes.join("; ")}]` : ""),
      );
      continue;
    }
    if (ndviResult.approximate) notes.push(`approximate reading (field is ${field.area_hectares ?? "?"} ha)`);

    // 3. Anomaly detection runs on the newest usable image only, and only
    // if that image date is new. Older days in the window are history.
    const image = usable[usable.length - 1];
    const noteText = notes.length ? ` [${notes.join("; ")}]` : "";
    if (knownDates.has(image.date)) {
      results.push(`${field.field_name}: no new image (latest ${image.date} already checked), saved ${saved.saved}${noteText}`);
      continue;
    }
    newImages++;
    // A field that just got its first 90 days: treat it like a backfill.
    // Alerts should mean "just detected", not something from weeks ago.
    const ageDays = (to.getTime() - new Date(image.date).getTime()) / DAY_MS;
    if (ageDays > LOOKBACK_DAYS) {
      results.push(`${field.field_name}: saved ${saved.saved} past readings, newest ${image.date} too old to alert on${noteText}`);
      continue;
    }

    // Baseline: this field's own readings BEFORE this image date.
    const { data: history } = await supabase
      .from("satellite_images")
      .select("ndvi_value")
      .eq("field_id", field.id)
      .lt("capture_date", image.date)
      .order("capture_date", { ascending: false })
      .limit(30);

    if (!history || history.length < 3) {
      results.push(`${field.field_name}: NDVI ${image.ndvi.toFixed(2)} saved, not enough history for a baseline yet${noteText}`);
      continue;
    }
    const baseline = history.reduce((sum, r) => sum + Number(r.ndvi_value), 0) / history.length;
    const dropPct = baseline > 0 ? ((baseline - image.ndvi) / baseline) * 100 : 0;

    if (dropPct < DROP_THRESHOLD_PCT) {
      results.push(`${field.field_name}: normal (NDVI ${image.ndvi.toFixed(2)}, baseline ${baseline.toFixed(2)})${noteText}`);
      continue;
    }

    // Weather for the image date, or the closest earlier day we have.
    const weather =
      weatherReadings.find((w) => w.date === image.date) ??
      [...weatherReadings].reverse().find((w) => w.date <= image.date) ??
      null;
    if (!weather) {
      results.push(`${field.field_name}: ${dropPct.toFixed(0)}% drop but no weather data to explain it${noteText}`);
      continue;
    }

    const growthStage = computeGrowthStage(field.crop_type, field.planted_date, new Date(image.date), field.maturity_days ?? null);
    const isExpectedSenescence = growthStage?.nearingHarvest === true;

    // 4. Cause inference (rainfall thresholds from the design document)
    const { cause, confidence } = isExpectedSenescence
      ? { cause: "natural_senescence", confidence: 70 }
      : inferCause(weather.rainfallMm);

    // 5. Recommendation
    const solutionText = isExpectedSenescence
      ? `This is likely natural ripening. The crop is around day ${growthStage!.daysSincePlanting} of an expected ${growthStage!.daysToMaturity}-day season. If the drop seems too early or too big for that stage, walk the field to check.`
      : recommend(cause);

    // 6. Alert, in plain words. The farmer sees "crop health", not "NDVI".
    const drop = dropPct.toFixed(0);
    const message = isExpectedSenescence
      ? `Crop health dropped ${drop}% below this field's usual level, which is normal close to harvest. ${solutionText}`
      : `Possible ${CAUSE_WORDS[cause] ?? "stress"}: crop health dropped ${drop}% below this field's usual level. ${solutionText}`;

    // The drop, cause, advice and alert are saved together in one database
    // transaction (patch_009), so a farmer can never get half an alert. The
    // same function refuses repeats: one alert per image date, and none
    // while this field already has an unanswered alert from the last 14 days.
    const { data: created, error: createErr } = await supabase.rpc("create_alert", {
      p_field_id: field.id,
      p_date_detected: image.date,
      p_drop_pct: Number(dropPct.toFixed(1)),
      p_severity: isExpectedSenescence ? "low" : dropPct > 30 ? "high" : "moderate",
      p_cause_type: cause,
      p_confidence: confidence,
      p_solution_text: solutionText,
      p_message_text: message,
    });
    if (createErr) {
      results.push(`${field.field_name}: ${drop}% drop found but the alert could not be saved: ${createErr.message}${noteText}`);
      await failed(field, `Alert could not be saved: ${createErr.message}`);
      continue;
    }
    const outcome = (created as { status?: string; open_since?: string } | null)?.status;
    if (outcome === "suppressed") {
      results.push(`${field.field_name}: ${drop}% drop, no new alert (one from ${(created as { open_since?: string }).open_since} is still unanswered)${noteText}`);
      continue;
    }
    if (outcome === "duplicate") {
      results.push(`${field.field_name}: ${drop}% drop already alerted for ${image.date}${noteText}`);
      continue;
    }
    alertsCreated++;
    results.push(`${field.field_name}: ${isExpectedSenescence ? "EXPECTED RIPENING" : "ALERT"} (${cause}, ${drop}% drop)${noteText}`);

    // Straight to the farmer's notification bar, on every device they
    // turned notifications on for. Ripening isn't a problem, so no buzz.
    if (!isExpectedSenescence) {
      const sent = await notifyFarmer(supabase, field.farmer_id, "alerts", {
        title: `${field.field_name}: possible ${CAUSE_WORDS[cause] ?? "stress"}`,
        body: `Crop health dropped ${drop}% below this field's usual level. Tap to see what to do.`,
        url: "/alerts",
        tag: `alert-${field.id}`,
      });
      if (sent > 0) pushesSent += sent;
    }
  }

  await logEvent("pipeline.run_finished", {
    fields_checked: (fields ?? []).length,
    new_images: newImages,
    failures,
    alerts_created: alertsCreated,
    notifications_sent: pushesSent,
    duration_ms: Date.now() - started,
  });

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
