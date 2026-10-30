import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitAlertFeedback } from "../lib/api/alerts";
import type { AlertWithRecommendation } from "../lib/types";

const severityStyle: Record<string, string> = {
  low: "bg-sky-100 text-sky-700",
  moderate: "bg-laterite-100 text-laterite-700",
  high: "bg-laterite-700 text-white",
};

const statusStyle: Record<string, string> = {
  open: "bg-growth-100 text-growth-700",
  reviewed: "bg-sky-100 text-sky-700",
  dismissed: "bg-canopy-900/10 text-ink/70 dark:text-parchment/70",
};

type Props = {
  alerts: AlertWithRecommendation[];
  fieldId: string;
  onFeedbackSubmitted: () => void;
};

export default function AlertsPanel({ alerts, fieldId, onFeedbackSubmitted }: Props) {
  return (
    <div className="rounded-2xl bg-white dark:bg-night-900 shadow-sm shadow-canopy-900/5 dark:shadow-none p-4">
      <p className="mb-3 font-display text-sm font-semibold text-ink dark:text-parchment">Alerts &amp; recommendations</p>
      <div className="space-y-3">
        {alerts.map((a) => (
          <AlertRow key={a.id} alert={a} fieldId={fieldId} onFeedbackSubmitted={onFeedbackSubmitted} />
        ))}
        {alerts.length === 0 && (
          <p className="text-sm text-ink/70 dark:text-parchment/70">No alerts for this field. NDVI is tracking normally.</p>
        )}
      </div>
    </div>
  );
}

function AlertRow({
  alert,
  fieldId,
  onFeedbackSubmitted,
}: {
  alert: AlertWithRecommendation;
  fieldId: string;
  onFeedbackSubmitted: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "correcting">("idle");
  const [correction, setCorrection] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, boolean, { previous?: any }>({
    mutationFn: (accurate: boolean) =>
      submitAlertFeedback({ anomalyId: alert.anomaly_id, alertId: alert.id, farmerId: alert.farmer_id, accurate, correction }),

    // Optimistic update: the row shows its new status the instant you click,
    // before the network round trip finishes. If the write fails, the exact
    // previous state is restored, so the UI never shows a false success.
    onMutate: async (accurate: boolean) => {
      await queryClient.cancelQueries({ queryKey: ["fieldDetail", fieldId] });
      const previous = queryClient.getQueryData<any>(["fieldDetail", fieldId]);
      queryClient.setQueryData<any>(["fieldDetail", fieldId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          alerts: old.alerts.map((a: AlertWithRecommendation) =>
            a.id === alert.id ? { ...a, status: accurate ? "reviewed" : "dismissed" } : a,
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["fieldDetail", fieldId], context.previous);
    },
    onSuccess: () => {
      setMode("idle");
      setCorrection("");
      onFeedbackSubmitted();
    },
  });

  return (
    <div className="border-b border-canopy-900/5 dark:border-white/5 pb-3 last:border-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${severityStyle[alert.severity]}`}>
          {alert.severity}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-ink/70 dark:text-parchment/70">{alert.date_detected}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[alert.status]}`}>
              {alert.status}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-ink/80 dark:text-parchment/80">{alert.message_text}</p>

          {alert.status === "open" && mode === "idle" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => mutation.mutate(true)}
                disabled={mutation.isPending}
                className="rounded-lg bg-growth-50 px-2.5 py-1 text-xs font-medium text-growth-700 hover:bg-growth-100 disabled:opacity-50"
              >
                This looks right
              </button>
              <button
                onClick={() => setMode("correcting")}
                disabled={mutation.isPending}
                className="rounded-lg border border-canopy-900/15 dark:border-white/15 px-2.5 py-1 text-xs font-medium text-ink/70 dark:text-parchment/70 hover:bg-parchment dark:hover:bg-white/5 disabled:opacity-50"
              >
                Not accurate
              </button>
              {mutation.isPending && <span className="text-xs text-ink/70 dark:text-parchment/70">Saving…</span>}
            </div>
          )}

          {mode === "correcting" && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={correction}
                onChange={(e) => setCorrection(e.target.value)}
                placeholder="What actually happened in this field?"
                disabled={mutation.isPending}
                className="flex-1 rounded-lg border border-canopy-900/15 dark:border-white/15 px-2.5 py-1.5 text-sm focus:border-growth-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={() => correction.trim() && mutation.mutate(false)}
                disabled={mutation.isPending || !correction.trim()}
                className="rounded-lg bg-growth-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-growth-600/90 disabled:opacity-50"
              >
                {mutation.isPending ? "Sending…" : "Send"}
              </button>
            </div>
          )}

          {mutation.isError && (
            <p className="mt-2 text-xs text-laterite-700">{mutation.error.message} Please try again.</p>
          )}
        </div>
      </div>
    </div>
  );
}
