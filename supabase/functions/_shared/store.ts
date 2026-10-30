// Shared write helpers for daily-pipeline and backfill-field.
//
// Why this file exists: both functions used to call .upsert() and never
// look at the returned error. When the is_approximate column was missing
// from the live database, EVERY satellite reading was rejected by Postgres
// and nothing was saved, but the functions still reported success. These
// helpers check every write and say exactly what failed.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { NdviReading } from "./sentinel.ts";
import type { WeatherReading } from "./weather.ts";

// Postgres code for "column does not exist".
const UNDEFINED_COLUMN = "42703";

export type SaveResult = { saved: number; error: string | null; warning: string | null };

/** Saves NDVI readings. If the is_approximate column is missing (patch_006
 *  not run yet), it saves the readings without that column instead of
 *  losing them, and returns a warning so the gap is visible. */
export async function saveNdviReadings(
  supabase: SupabaseClient,
  fieldId: string,
  readings: NdviReading[],
  approximate: boolean,
): Promise<SaveResult> {
  if (readings.length === 0) return { saved: 0, error: null, warning: null };

  const rows = readings.map((r) => ({
    field_id: fieldId,
    capture_date: r.date,
    ndvi_value: r.ndvi,
    cloud_cover_pct: r.cloudCoverPct,
    is_approximate: approximate,
  }));

  const first = await supabase.from("satellite_images").upsert(rows, { onConflict: "field_id,capture_date" });
  if (!first.error) return { saved: rows.length, error: null, warning: null };

  if (first.error.code === UNDEFINED_COLUMN) {
    const plainRows = rows.map(({ is_approximate: _drop, ...rest }) => rest);
    const retry = await supabase.from("satellite_images").upsert(plainRows, { onConflict: "field_id,capture_date" });
    if (!retry.error) {
      return {
        saved: plainRows.length,
        error: null,
        warning: "satellite_images.is_approximate is missing. Run supabase/patch_006_ndvi_approximate_and_diagnostics.sql.",
      };
    }
    return { saved: 0, error: retry.error.message, warning: null };
  }
  return { saved: 0, error: first.error.message, warning: null };
}

export async function saveWeatherReadings(
  supabase: SupabaseClient,
  fieldId: string,
  readings: WeatherReading[],
): Promise<SaveResult> {
  if (readings.length === 0) return { saved: 0, error: null, warning: null };
  const rows = readings.map((r) => ({
    field_id: fieldId,
    record_date: r.date,
    rainfall_mm: r.rainfallMm,
    temperature_c: r.tempC,
    humidity_pct: r.humidityPct,
  }));
  const { error } = await supabase.from("weather_records").upsert(rows, { onConflict: "field_id,record_date" });
  return error ? { saved: 0, error: error.message, warning: null } : { saved: rows.length, error: null, warning: null };
}
