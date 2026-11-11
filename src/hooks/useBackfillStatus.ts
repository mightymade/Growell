import { useQuery } from "@tanstack/react-query";
import type { LastCheck } from "../lib/backfill";

/** True while a new field's history is still being downloaded. */
export function useBackfillStatus(fieldId: string | null) {
  const q = useQuery({
    queryKey: ["backfill", fieldId],
    queryFn: () => false,
    enabled: false,
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  });
  return q.data === true;
}

/** What the last check for this field found (lib/backfill.ts records it). */
export function useLastCheck(fieldId: string | null) {
  const q = useQuery<LastCheck | null>({
    queryKey: ["checkResult", fieldId],
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });
  return q.data ?? null;
}
