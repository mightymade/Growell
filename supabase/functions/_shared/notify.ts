// Sends a notification to every device a farmer turned notifications on
// for, and tidies up devices that have unsubscribed.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPush, type VapidKeys } from "./webpush.ts";

export type Message = {
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other on the device. */
  tag?: string;
};

/** The VAPID keys from the function's secrets, or null if not set up yet. */
export function vapidKeys(): VapidKeys | null {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: Deno.env.get("VAPID_SUBJECT") || "mailto:growell@example.com" };
}

/**
 * kind: which setting must be on ("alerts" or "weekly"). Returns how many
 * devices got it. Never throws: notifications must never break the job.
 */
export async function notifyFarmer(
  db: SupabaseClient,
  farmerId: string,
  kind: "alerts" | "weekly" | "test",
  message: Message,
): Promise<number> {
  const keys = vapidKeys();
  if (!keys) return 0;
  try {
    if (kind !== "test") {
      const { data: prefs, error } = await db.from("farmers").select("notify_alerts, notify_weekly").eq("id", farmerId).maybeSingle();
      if (error) return 0; // patch_012 not installed
      if (kind === "alerts" && prefs?.notify_alerts === false) return 0;
      if (kind === "weekly" && prefs?.notify_weekly === false) return 0;
    }
    const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("farmer_id", farmerId);
    let sent = 0;
    for (const s of subs ?? []) {
      const r = await sendPush(s, { ...message, kind }, keys, {
        urgency: kind === "alerts" ? "high" : "normal",
        topic: message.tag,
        ttl: kind === "weekly" ? 3 * 24 * 60 * 60 : 24 * 60 * 60,
      });
      if (r.ok) {
        sent++;
        await db.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), failures: 0 }).eq("id", s.id);
      } else if (r.gone) {
        // The browser unsubscribed or the app was removed: forget this device.
        await db.from("push_subscriptions").delete().eq("id", s.id);
      } else {
        const { data } = await db.from("push_subscriptions").select("failures").eq("id", s.id).maybeSingle();
        const failures = (data?.failures ?? 0) + 1;
        // After many failures in a row, stop trying this device.
        if (failures >= 10) await db.from("push_subscriptions").delete().eq("id", s.id);
        else await db.from("push_subscriptions").update({ failures }).eq("id", s.id);
      }
    }
    return sent;
  } catch (err) {
    console.warn("notifyFarmer failed:", (err as Error).message);
    return 0;
  }
}
