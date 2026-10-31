import { supabase } from "../supabase";

/**
 * Collects everything Growell holds about the signed-in farmer that they
 * can see (the database rules decide), and saves it as one JSON file.
 * This is the farmer's right of access (Data Protection and Privacy Act,
 * s.24), available any time without asking.
 */
export async function downloadMyData(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error("Please log in again.");

  const take = async <T,>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, what: string): Promise<T> => {
    const { data, error } = await p;
    if (error) throw new Error(`Couldn't collect your ${what}. Please try again.`);
    return (data ?? []) as T;
  };

  const profile = await take(supabase.from("farmers").select("*").eq("id", user.id).maybeSingle(), "profile");
  const fields = await take(
    supabase.from("fields").select("id, field_name, crop_type, area_hectares, planted_date, boundary_coords, created_at").order("created_at"),
    "fields",
  );
  const ids = (fields as { id: string }[]).map((f) => f.id);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [readings, weather, alerts, feedback] = await Promise.all([
    take(supabase.from("satellite_images").select("field_id, capture_date, ndvi_value, cloud_cover_pct, is_approximate").in("field_id", ids.length ? ids : none).order("capture_date"), "satellite readings"),
    take(supabase.from("weather_records").select("field_id, record_date, rainfall_mm, temperature_c, humidity_pct").in("field_id", ids.length ? ids : none).order("record_date"), "weather records"),
    take(
      supabase
        .from("anomalies")
        .select("id, field_id, date_detected, ndvi_drop_pct, severity, status, inferred_causes(cause_type, confidence_pct, recommendations(solution_text)), alerts(id, message_text, date_sent, viewed_flag)")
        .in("field_id", ids.length ? ids : none)
        .order("date_detected"),
      "alerts",
    ),
    take(supabase.from("farmer_feedback").select("alert_id, actual_cause, date_submitted").eq("farmer_id", user.id), "alert answers"),
  ]);

  const file = {
    about:
      "This is all the data Growell holds about you that is linked to your account. Fields you deleted are not included; they are removed when your account is deleted. See the Privacy Policy for details.",
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at },
    profile,
    fields,
    satellite_readings: readings,
    weather_records: weather,
    alerts,
    alert_answers: feedback,
  };

  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  a.href = url;
  a.download = `growell-my-data-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
