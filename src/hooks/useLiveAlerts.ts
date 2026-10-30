import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { queryClient } from "../lib/queryClient";
import { ALERTS_KEY, type FieldAlert } from "./useAllFieldAlerts";

export type AlertToast = { key: number; count: number; first: FieldAlert };

/**
 * Keeps alerts current while the app is open, and says when new ones arrive.
 *
 * - Listens to Supabase Realtime for new alerts and status changes
 *   (patch_009 turns this on). Row level security still applies, so a
 *   farmer only ever hears about their own fields. If Realtime is not set
 *   up, the 5-minute refresh in useAllFieldAlerts still catches them.
 * - Compares each fresh list with the last one and raises a toast for
 *   unread alerts it hasn't seen before. The first list after opening the
 *   app counts too, but only alerts that arrived since the last visit.
 * - Shows the unread count in the browser tab title, e.g. "(2) Growell".
 */
export function useLiveAlerts(alerts: FieldAlert[], loaded: boolean) {
  const [toast, setToast] = useState<AlertToast | null>(null);
  const known = useRef<Set<string> | null>(null);
  const lastVisit = useRef<string>(readLastVisit());

  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["fieldDetail"] });
    };
    const channel = supabase
      .channel("growell-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "anomalies" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const fresh = alerts.filter((a) => !a.viewed && a.status === "open");
    if (known.current === null) {
      // First list this session: only alerts raised since the last visit are news.
      known.current = new Set(alerts.map((a) => a.id));
      const sinceLastVisit = fresh.filter((a) => a.date_sent > lastVisit.current);
      if (sinceLastVisit.length > 0) setToast({ key: Date.now(), count: sinceLastVisit.length, first: sinceLastVisit[0] });
    } else {
      const added = fresh.filter((a) => !known.current!.has(a.id));
      alerts.forEach((a) => known.current!.add(a.id));
      if (added.length > 0) setToast({ key: Date.now(), count: added.length, first: added[0] });
    }
    writeLastVisit();
  }, [alerts, loaded]);

  const unread = alerts.filter((a) => !a.viewed && a.status === "open").length;
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Growell` : "Growell";
  }, [unread]);

  return { toast, dismissToast: () => setToast(null), unread };
}

const LAST_VISIT_KEY = "growell_alerts_seen_at";
function readLastVisit(): string {
  try {
    return localStorage.getItem(LAST_VISIT_KEY) ?? new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}
function writeLastVisit() {
  try {
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
  } catch {
    /* private window: the toast just won't cover alerts from past visits */
  }
}
