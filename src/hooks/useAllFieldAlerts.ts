import { useQuery } from "@tanstack/react-query";
import { fetchAllAlerts } from "../lib/api/alerts";

export type FieldAlert = {
  id: string;
  anomaly_id: string;
  farmer_id: string;
  field_id: string;
  field_name: string;
  message_text: string;
  date_detected: string;
  /** When the alert was raised (a timestamp, newer than date_detected). */
  date_sent: string;
  /** The farmer has seen it. Drives the red "new" counts, not the "to answer" counts. */
  viewed: boolean;
  severity: "low" | "moderate" | "high";
  status: "open" | "reviewed" | "dismissed";
  cause_type: string | null;
  confidence_pct: number | null;
};

const NONE: FieldAlert[] = [];

export const ALERTS_KEY = ["alerts", "all"] as const;

/** Alerts across every field. Layout, Home and the Alerts page all use
 *  this, sharing one cache entry, so it is fetched once, not three times.
 *  It also re-checks every 5 minutes and when the farmer comes back to the
 *  tab, as a safety net under the live updates (useLiveAlerts). */
export function useAllFieldAlerts() {
  const q = useQuery({
    queryKey: ALERTS_KEY,
    queryFn: fetchAllAlerts,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
  return {
    alerts: q.data ?? NONE,
    loading: q.isPending,
    refetch: async () => {
      await q.refetch();
    },
  };
}
