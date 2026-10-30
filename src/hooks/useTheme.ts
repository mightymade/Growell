import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
const STORAGE_KEY = "growell_theme";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveIsDark(pref: ThemePreference): boolean {
  return pref === "dark" || (pref === "system" && systemPrefersDark());
}

let firstApply = true;

function applyTheme(pref: ThemePreference) {
  const dark = resolveIsDark(pref);
  const root = document.documentElement;
  // Cross-fade colours on a real switch (not on page load) for 200ms only,
  // so the rest of the time nothing carries a colour transition.
  if (!firstApply && root.classList.contains("dark") !== dark) {
    root.classList.add("theme-switching");
    window.setTimeout(() => root.classList.remove("theme-switching"), 220);
  }
  firstApply = false;
  document.documentElement.classList.toggle("dark", dark);
  // Keeps the phone's own status bar / address bar in sync with the app.
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#121212" : "#13281A");
}

/**
 * Reads/writes the same preference the inline script in index.html
 * applies before React ever loads (that script is what prevents a flash
 * of the wrong theme on first paint — this hook just keeps everything
 * after that in sync with it, and reacts to the "system" option
 * following the OS setting live if it changes.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "light" || stored === "dark" ? stored : "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    applyTheme(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // ignore — theme still applies for this session, just won't persist
    }
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setTheme = useCallback((next: ThemePreference) => setPreference(next), []);

  return { preference, setTheme, isDark: resolveIsDark(preference) };
}
