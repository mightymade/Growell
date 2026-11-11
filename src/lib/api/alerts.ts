import { supabase } from "../supabase";
import { toFriendlyError, unwrap } from "../apiError";
import type { AlertWithRecommendation } from "../types";
import type { FieldAlert } from "../../hooks/useAllFieldAlerts";

const ALERT_SELECT =
  "id, date_detected, severity, status, fields(id, field_name), alerts(id, message_text, date_sent, viewed_flag), inferred_causes(cause_type, confidence_pct)";

function toFieldAlerts(rows: any[], farmerId: string): FieldAlert[] {
  return rows.flatMap((a: any) => {
    const cause = Array.isArray(a.inferred_causes) ? a.inferred_causes[0] : a.inferred_causes;
    return (a.alerts ?? []).map((al: any) => ({
      id: al.id,
      anomaly_id: a.id,
      farmer_id: farmerId,
      field_id: a.fields?.id ?? "",
      field_name: a.fields?.field_name ?? "Unknown field",
      message_text: al.message_text,
      date_detected: a.date_detected,
      date_sent: al.date_sent ?? `${a.date_detected}T00:00:00Z`,
      viewed: al.viewed_flag === true,
      severity: a.severity,
      status: a.status,
      cause_type: cause?.cause_type ?? null,
      confidence_pct: cause?.confidence_pct == null ? null : Number(cause.confidence_pct),
    }));
  });
}

/**
 * Every alert that still needs an answer, plus the 50 newest answered
 * ones. Open alerts are fetched on their own so the counts stay right even
 * for a farmer with a long history (a single "newest 50" list could push
 * an old unanswered alert off the end and out of every badge).
 */
export async function fetchAllAlerts(): Promise<FieldAlert[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const farmerId = sessionData.session?.user.id ?? "";
  const [openRes, recentRes] = await Promise.all([
    supabase.from("anomalies").select(ALERT_SELECT).eq("status", "open").order("date_detected", { ascending: false }).limit(200),
    supabase.from("anomalies").select(ALERT_SELECT).neq("status", "open").order("date_detected", { ascending: false }).limit(50),
  ]);
  const all = [...toFieldAlerts(unwrap(openRes) ?? [], farmerId), ...toFieldAlerts(unwrap(recentRes) ?? [], farmerId)];
  return all.sort((x, y) => (x.date_sent < y.date_sent ? 1 : x.date_sent > y.date_sent ? -1 : 0));
}

/** Marks alerts as seen. Row level security only lets a farmer change
 *  their own alerts, so other ids are simply ignored by the database. */
export async function markAlertsViewed(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("alerts").update({ viewed_flag: true }).in("id", ids);
  if (error) throw toFriendlyError(error, "Couldn't mark those alerts as read.");
}

export type FieldAlertsResult = {
  ndviHistory: any[];
  weatherHistory: any[];
  alerts: AlertWithRecommendation[];
  /** Plain-language notes about parts that failed to load. Each part loads
   *  on its own, so a broken satellite query no longer blanks the weather
   *  and alerts too (which is what made every card show a dash). */
  problems: string[];
};

// Postgres code for "column does not exist".
const UNDEFINED_COLUMN = "42703";

async function fetchNdvi(fieldId: string) {
  const base = () =>
    supabase.from("satellite_images").select("capture_date, ndvi_value, is_approximate").eq("field_id", fieldId);
  const res = await base().order("capture_date", { ascending: true }).limit(400);
  if (res.error?.code !== UNDEFINED_COLUMN) return res;
  // Database not patched yet (patch_006). Load the readings without the
  // is_approximate flag rather than showing nothing at all.
  return supabase
    .from("satellite_images")
    .select("capture_date, ndvi_value")
    .eq("field_id", fieldId)
    .order("capture_date", { ascending: true })
    .limit(200);
}

export async function fetchFieldDetail(fieldId: string): Promise<FieldAlertsResult> {
  const [{ data: sessionData }, ndviRes, weatherRes, anomalyRes] = await Promise.all([
    supabase.auth.getSession(),
    fetchNdvi(fieldId),
    supabase
      .from("weather_records")
      .select("record_date, rainfall_mm, temperature_c, humidity_pct")
      .eq("field_id", fieldId)
      .order("record_date", { ascending: false })
      // Up to a year, for a field planted long ago.
      .limit(370),
    supabase
      .from("anomalies")
      .select("id, date_detected, severity, status, alerts(id, message_text, date_sent, viewed_flag)")
      .eq("field_id", fieldId)
      .order("date_detected", { ascending: false })
      .limit(20),
  ]);

  // Nothing at all came back: that's a connection or session problem, so
  // let the normal error handling deal with it.
  if (ndviRes.error && weatherRes.error && anomalyRes.error) throw toFriendlyError(ndviRes.error);

  const problems: string[] = [];
  if (ndviRes.error) {
    console.error(ndviRes.error);
    problems.push("Satellite readings couldn't be loaded.");
  }
  if (weatherRes.error) {
    console.error(weatherRes.error);
    problems.push("Weather history couldn't be loaded.");
  }
  if (anomalyRes.error) {
    console.error(anomalyRes.error);
    problems.push("Alerts couldn't be loaded.");
  }

  const farmerId = sessionData.session?.user.id ?? "";
  const ndviHistory = ((ndviRes.data ?? []) as any[])
    .map((r) => ({ ...r, ndvi_value: Number(r.ndvi_value) }))
    // A stored "NaN" from the old parser is not a reading.
    .filter((r) => Number.isFinite(r.ndvi_value));
  // Newest year, then put back in date order for the charts.
  const weatherHistory = (weatherRes.data ?? [])
    .map((r) => ({
      ...r,
      rainfall_mm: r.rainfall_mm === null ? null : Number(r.rainfall_mm),
      temperature_c: r.temperature_c === null ? null : Number(r.temperature_c),
      humidity_pct: r.humidity_pct === null ? null : Number(r.humidity_pct),
    }))
    .reverse();
  const alerts: AlertWithRecommendation[] = (anomalyRes.data ?? []).flatMap((a: any) =>
    (a.alerts ?? []).map((al: any) => ({
      id: al.id,
      message_text: al.message_text,
      date_sent: al.date_sent,
      viewed_flag: al.viewed_flag,
      anomaly_id: a.id,
      date_detected: a.date_detected,
      severity: a.severity,
      status: a.status,
      farmer_id: farmerId,
    })),
  );
  return { ndviHistory, weatherHistory, alerts, problems };
}

// Messages the database function raises on purpose; safe to show as-is.
const SHOWN_CODES = new Set(["P0002", "22023", "22001", "28000"]);
// The function isn't there yet (patch_009 not run).
const MISSING_FUNCTION = new Set(["PGRST202", "42883"]);

/**
 * Confirming or correcting an alert. One database call (patch_009) updates
 * the alert's status, marks it read and saves the feedback together, and
 * checks the alert belongs to the signed-in farmer. Answering again
 * replaces the earlier answer instead of adding a second one.
 */
export async function submitAlertFeedback(args: {
  anomalyId: string;
  alertId: string;
  farmerId: string;
  accurate: boolean;
  correction?: string;
}): Promise<"reviewed" | "dismissed"> {
  const { data, error } = await supabase.rpc("submit_alert_feedback", {
    p_alert_id: args.alertId,
    p_accurate: args.accurate,
    p_correction: args.accurate ? null : args.correction?.trim() || null,
  });
  if (!error) return data as "reviewed" | "dismissed";
  if (SHOWN_CODES.has(error.code)) throw new Error(error.message);
  if (!MISSING_FUNCTION.has(error.code)) throw toFriendlyError(error, "Couldn't save your answer. Please try again.");

  // Older database without patch_009: the previous two-step save.
  console.warn("submit_alert_feedback is missing. Run supabase/patch_009_alert_system.sql.");
  const status = args.accurate ? "reviewed" : "dismissed";
  const [anomalyRes, feedbackRes] = await Promise.all([
    supabase.from("anomalies").update({ status }).eq("id", args.anomalyId),
    supabase.from("farmer_feedback").insert({
      alert_id: args.alertId,
      farmer_id: args.farmerId,
      actual_cause: args.accurate ? null : args.correction?.trim() || null,
    }),
  ]);
  if (anomalyRes.error) throw toFriendlyError(anomalyRes.error, "Couldn't save your answer. Please try again.");
  if (feedbackRes.error) throw toFriendlyError(feedbackRes.error, "Couldn't save your answer. Please try again.");
  return status;
}
