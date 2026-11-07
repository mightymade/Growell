// Notifications for Growell.
//
//   GET                       -> { publicKey }  The app needs this to turn
//                                notifications on. Public, no login needed.
//   POST { kind: "test" }     -> sends a test notification to the signed-in
//                                farmer's own devices (from Settings).
//   POST { kind: "weekly" }   -> the weekly field report for every farmer.
//                                Only the weekly schedule may call this: it
//                                must send the x-pipeline-key header.
//
// Deploy: supabase functions deploy notify --no-verify-jwt
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (see README),
//          PIPELINE_KEY (already set for the daily check).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyFarmer, vapidKeys } from "../_shared/notify.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const db = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function sameKey(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Same words and limits as the app (src/lib/ndviColor.ts).
function healthWord(v: number) {
  if (v < 0.2) return "Poor";
  if (v < 0.4) return "Fair";
  if (v < 0.6) return "Good";
  return "Very good";
}

type Reading = { field_id: string; capture_date: string; ndvi_value: number };

/** One farmer's week in one or two short sentences. */
function weeklyText(fields: { id: string; field_name: string }[], readings: Reading[], openAlerts: number): string {
  const lines: { name: string; word: string | null; change: number | null }[] = fields.map((f) => {
    const mine = readings.filter((r) => r.field_id === f.id).sort((a, b) => b.capture_date.localeCompare(a.capture_date));
    const latest = mine[0];
    if (!latest) return { name: f.field_name, word: null, change: null };
    const cutoff = new Date(new Date(latest.capture_date).getTime() - 5 * 86_400_000).toISOString().slice(0, 10);
    const before = mine.find((r) => r.capture_date <= cutoff);
    const now = Number(latest.ndvi_value);
    const change = before && Number(before.ndvi_value) > 0 ? Math.round(((now - Number(before.ndvi_value)) / Number(before.ndvi_value)) * 100) : null;
    return { name: f.field_name, word: healthWord(now), change };
  });

  const alertText = openAlerts > 0 ? ` ${openAlerts} alert${openAlerts === 1 ? " needs" : "s need"} your answer.` : "";

  if (lines.length === 1) {
    const l = lines[0];
    if (!l.word) return `No clear satellite image of ${l.name} yet. Growell keeps checking.${alertText}`;
    const trend =
      l.change === null ? "" : l.change <= -5 ? `, down ${Math.abs(l.change)}% since last week` : l.change >= 5 ? `, up ${l.change}% since last week` : ", steady since last week";
    return `${l.name} is ${l.word.toLowerCase()}${trend}.${alertText}`;
  }

  const counts = new Map<string, number>();
  for (const l of lines) if (l.word) counts.set(l.word, (counts.get(l.word) ?? 0) + 1);
  const order = ["Very good", "Good", "Fair", "Poor"];
  const summary = order.filter((w) => counts.has(w)).map((w) => `${counts.get(w)} ${w.toLowerCase()}`).join(", ");
  const dropped = lines.filter((l) => l.change !== null && l.change <= -5).sort((a, b) => a.change! - b.change!);
  const dropText =
    dropped.length === 0
      ? " None dropped this week."
      : dropped.length === 1
        ? ` ${dropped[0].name} dropped ${Math.abs(dropped[0].change!)}%.`
        : ` ${dropped.length} dropped, most ${dropped[0].name} (${Math.abs(dropped[0].change!)}%).`;
  return `${lines.length} fields${summary ? `: ${summary}` : ""}.${dropText}${alertText}`.slice(0, 220);
}

async function weekly() {
  const { data: subs, error } = await db.from("push_subscriptions").select("farmer_id");
  if (error) return { error: error.message };
  const farmerIds = [...new Set((subs ?? []).map((s) => s.farmer_id as string))];
  const since = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10);
  let sent = 0;
  let farmers = 0;

  for (const farmerId of farmerIds) {
    const { data: fields } = await db.from("fields").select("id, field_name").eq("farmer_id", farmerId).is("deleted_at", null);
    if (!fields || fields.length === 0) continue;
    const ids = fields.map((f) => f.id);
    const { data: readings } = await db
      .from("satellite_images")
      .select("field_id, capture_date, ndvi_value")
      .in("field_id", ids)
      .gte("capture_date", since);
    const { count } = await db.from("anomalies").select("id", { count: "exact", head: true }).in("field_id", ids).eq("status", "open");
    farmers++;
    sent += await notifyFarmer(db, farmerId, "weekly", {
      title: "Your weekly field report",
      body: weeklyText(fields, (readings ?? []) as Reading[], count ?? 0),
      url: "/home",
      tag: "weekly",
    });
  }

  const { error: logErr } = await db.rpc("log_system_event", {
    p_action: "pipeline.weekly_summary",
    p_entity_id: null,
    p_entity_name: null,
    p_details: { farmers, notifications_sent: sent },
  });
  if (logErr) console.warn("could not record the weekly summary:", logErr.message);
  return { farmers, notifications_sent: sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.method === "GET") {
    return json({ publicKey: vapidKeys()?.publicKey ?? null });
  }
  if (req.method !== "POST") return json({ error: "Not allowed" }, 405);

  let kind = "";
  try {
    kind = String((await req.json()).kind ?? "");
  } catch {
    // handled below
  }

  if (kind === "weekly") {
    const expected = Deno.env.get("PIPELINE_KEY") ?? "";
    if (!expected || !sameKey(req.headers.get("x-pipeline-key") ?? "", expected)) return json({ error: "Not allowed" }, 401);
    if (!vapidKeys()) return json({ error: "Notifications are not set up: VAPID keys missing." }, 500);
    return json(await weekly());
  }

  if (kind === "test") {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data } = await db.auth.getUser(token);
    if (!data?.user) return json({ error: "Please log in again." }, 401);
    if (!vapidKeys()) return json({ error: "Notifications aren't set up on the server yet." }, 500);
    const sent = await notifyFarmer(db, data.user.id, "test", {
      title: "Growell notifications are on",
      body: "This is how alerts about your fields will reach you.",
      url: "/settings/notifications",
      tag: "test",
    });
    return json({ sent });
  }

  return json({ error: "Unknown request" }, 400);
});
