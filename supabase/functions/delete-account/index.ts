// Deletes the signed-in farmer's account and all their data, straight away,
// then emails them a confirmation. This is the right to deletion under
// Uganda's Data Protection and Privacy Act, 2019 (s.16).
//
// What happens:
//   1. Checks who is asking (their login) and that they typed their
//      password again, so a phone left logged in can't be used to do this.
//   2. Removes their profile photo and their fields' satellite pictures
//      from storage.
//   3. Deletes the account. The database then deletes the profile, fields,
//      readings, weather, alerts and answers, and removes the name, email
//      and typed answers from the activity history (patch_011).
//   4. Emails a confirmation, if email sending is set up (see README).
//
// Deploy: supabase functions deploy delete-account --no-verify-jwt
// (The function checks the login itself, from the Authorization header.)
//
// Optional secrets, for the confirmation email through Gmail:
//   GMAIL_USER          the Gmail address that sends it
//   GMAIL_APP_PASSWORD  a Google "app password" for that address

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** Removes every file under a folder in a storage bucket. Never throws. */
async function removeFolder(bucket: string, folder: string) {
  try {
    const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
    const paths = (data ?? []).map((f) => `${folder}/${f.name}`);
    if (paths.length > 0) await admin.storage.from(bucket).remove(paths);
  } catch (err) {
    console.warn(`could not empty ${bucket}/${folder}:`, (err as Error).message);
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function sendConfirmation(to: string, name: string, fieldCount: number, when: Date): Promise<boolean> {
  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!user || !pass) return false;

  const date = when.toLocaleString("en-GB", { timeZone: "Africa/Kampala", dateStyle: "long", timeStyle: "short" });
  const fields = `${fieldCount} field${fieldCount === 1 ? "" : "s"}`;
  const text = [
    `Hello ${name},`,
    "",
    `As you asked on ${date} (Kampala time), we have deleted your Growell account (${to}) and all its data:`,
    `your profile and photo, your ${fields}, their satellite readings and weather records, and your alerts and answers.`,
    "",
    "Our activity record no longer contains your name, email or anything you typed.",
    "Our service providers may keep backup copies for a short time before they are overwritten.",
    "",
    "If you did not ask for this, reply to this email straight away.",
    "",
    "Thank you for using Growell.",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#16241C;max-width:520px">
<p>Hello ${escapeHtml(name)},</p>
<p>As you asked on ${escapeHtml(date)} (Kampala time), we have deleted your Growell account (${escapeHtml(to)}) and all its data:
your profile and photo, your ${fields}, their satellite readings and weather records, and your alerts and answers.</p>
<p>Our activity record no longer contains your name, email or anything you typed.
Our service providers may keep backup copies for a short time before they are overwritten.</p>
<p>If you did not ask for this, reply to this email straight away.</p>
<p>Thank you for using Growell.</p></div>`;

  try {
    const client = new SMTPClient({
      connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: user, password: pass } },
    });
    await client.send({ from: `Growell <${user}>`, to, subject: "Your Growell account has been deleted", content: text, html });
    await client.close();
    return true;
  } catch (err) {
    console.error("confirmation email failed:", (err as Error).message);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Not allowed" }, 405);

  // 1. Who is asking?
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user?.email) return json({ error: "Please log in again." }, 401);

  let password = "";
  try {
    password = String((await req.json()).password ?? "");
  } catch {
    // handled below
  }
  if (!password) return json({ error: "Please enter your password." }, 400);

  // Is the password right? Asks the login service directly.
  const check = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password }),
  });
  if (!check.ok) return json({ error: "That password is not right. Nothing was deleted." }, 403);

  // Details for the email, read before they are deleted.
  const { data: profile } = await admin.from("farmers").select("name").eq("id", user.id).maybeSingle();
  const { data: fields } = await admin.from("fields").select("id, deleted_at").eq("farmer_id", user.id);
  const name = profile?.name || user.email;
  const liveFields = (fields ?? []).filter((f) => !f.deleted_at).length;

  // 2. Files in storage.
  await removeFolder("avatars", user.id);
  for (const f of fields ?? []) await removeFolder("field-frames", f.id);

  // 3. The account. Everything linked to it goes with it.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("deleteUser failed:", error.message);
    return json({ error: "Couldn't delete your account. Nothing was deleted. Please try again." }, 500);
  }

  // 4. Confirmation email.
  const emailed = await sendConfirmation(user.email, name, liveFields, new Date());
  return json({ deleted: true, emailed, email: user.email });
});
