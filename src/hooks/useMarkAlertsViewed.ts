import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markAlertsViewed } from "../lib/api/alerts";
import { ALERTS_KEY, type FieldAlert } from "./useAllFieldAlerts";

/** Marks alerts as read. The red counts drop straight away and come back
 *  if the save fails, so the screen never waits on the network. */
export function useMarkAlertsViewed() {
  const qc = useQueryClient();
  return useMutation<void, Error, string[], { previous?: FieldAlert[] }>({
    mutationFn: markAlertsViewed,
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ALERTS_KEY });
      const previous = qc.getQueryData<FieldAlert[]>(ALERTS_KEY);
      const set = new Set(ids);
      qc.setQueryData<FieldAlert[]>(ALERTS_KEY, (old) => (old ?? []).map((a) => (set.has(a.id) ? { ...a, viewed: true } : a)));
      return { previous };
    },
    onError: (_e, _ids, ctx) => {
      if (ctx?.previous) qc.setQueryData(ALERTS_KEY, ctx.previous);
    },
  });
}
