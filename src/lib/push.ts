import { supabase } from "./supabase";

/**
 * Notifications in the phone's or computer's notification bar (Web Push).
 *
 * Works in Chrome, Edge, Firefox and Samsung Internet on Android and on
 * computers, and in Safari on Mac. On iPhone and iPad (iOS 16.4 or newer)
 * it only works once Growell is added to the Home Screen and opened from
 * there: Apple's rule, not ours.
 */

export type PushState =
  | "unsupported" // this browser can't do it
  | "ios-needs-install" // iPhone/iPad: add to Home Screen first
  | "blocked" // the person said no; only browser settings can undo it
  | "off" // can be turned on
  | "on"; // this device gets notifications

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Registers the service worker once, early, so it's ready when needed. */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker not registered:", err));
  });
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function pushState(): Promise<PushState> {
  if (isIos() && !isStandalone()) return "ios-needs-install";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const bin = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function serverKey(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("notify", { method: "GET" });
  const key = (data as { publicKey?: string | null } | null)?.publicKey;
  if (error || !key) throw new Error("Notifications aren't set up on the server yet.");
  return key;
}

/** Asks permission (must be called from a tap) and saves this device. */
export async function turnOnPush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";

  const reg = await registration();
  if (!reg) throw new Error("Couldn't start notifications in this browser.");
  await navigator.serviceWorker.ready;

  const key = await serverKey();
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with an old key can't be used: replace it.
  const current = sub?.options?.applicationServerKey;
  if (sub && current && btoa(String.fromCharCode(...new Uint8Array(current))) !== btoa(String.fromCharCode(...keyBytes(key)))) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw new Error("Couldn't save this device. Please try again.");
  return "on";
}

/** Stops notifications on this device only. */
export async function turnOffPush(): Promise<PushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe().catch(() => {});
  }
  return "off";
}

/** Sends a test notification to this farmer's devices. */
export async function sendTestPush(): Promise<number> {
  const { data, error } = await supabase.functions.invoke("notify", { body: { kind: "test" } });
  if (error) throw new Error("Couldn't send a test notification. Please try again.");
  return Number((data as { sent?: number } | null)?.sent ?? 0);
}

export type NotifyPrefs = { notify_alerts: boolean; notify_weekly: boolean };

export async function fetchNotifyPrefs(userId: string): Promise<NotifyPrefs | null> {
  const { data, error } = await supabase.from("farmers").select("notify_alerts, notify_weekly").eq("id", userId).maybeSingle();
  if (error) return null; // before patch_012
  return data as NotifyPrefs;
}

export async function saveNotifyPrefs(userId: string, prefs: Partial<NotifyPrefs>): Promise<void> {
  const { error } = await supabase.from("farmers").update(prefs).eq("id", userId);
  if (error) throw new Error("Couldn't save that setting. Please try again.");
}
