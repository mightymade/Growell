import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase env vars are missing. Copy .env.example to .env and fill in your project URL and anon key.",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Deliberately sessionStorage, not the default localStorage.
    // localStorage is shared across every tab of the same browser, so a
    // copied link in a new tab (or reopening the browser later) would
    // silently inherit whoever was last signed in. sessionStorage is
    // scoped to one tab and cleared the moment that tab closes, so a new
    // tab or a fresh browser session always lands on Login — no
    // exceptions, no separate "remember me" toggle to get wrong.
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
