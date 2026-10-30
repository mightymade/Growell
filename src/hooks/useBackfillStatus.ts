import { useQuery } from "@tanstack/react-query";

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
