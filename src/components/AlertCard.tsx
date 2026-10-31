import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitAlertFeedback } from "../lib/api/alerts";
import { ALERTS_KEY, type FieldAlert } from "../hooks/useAllFieldAlerts";
import { SEVERITY_LABEL, SEVERITY_STYLE, causeText, formatAlertDate } from "../lib/alertText";
import { BusyLabel } from "./Busy";
import Modal from "./Modal";
import { useIsPhone } from "../hooks/useIsPhone";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const STATUS: Record<string, { text: string; cls: string }> = {
  open: { text: "Needs your answer", cls: "bg-laterite-50 text-laterite-700" },
  reviewed: { text: "You confirmed this", cls: "bg-growth-100 text-growth-700" },
  dismissed: { text: "You said this was wrong", cls: "bg-canopy-900/10 text-ink/70 dark:bg-white/10 dark:text-parchment/70" },
};

// 48px on phones (thumb size), the compact 32px on computers.
const smallButton =
  "h-12 rounded-lg px-4 text-sm font-medium transition-colors active:scale-[0.98] md:h-8 md:rounded-md md:px-3 md:text-xs md:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-growth-600 disabled:opacity-50";

/**
 * One alert on the Alerts page: which field, when, the likely cause, what
 * to do, and the farmer's answer. Answering saves farmer feedback (used to
 * measure accuracy). An answer can be changed later; the new one replaces
 * the old.
 */
export default function AlertCard({
  alert,
  isNew = false,
  highlighted = false,
  onOpenField,
  onAnswered,
}: {
  alert: FieldAlert;
  /** Unread when the farmer opened this page. */
  isNew?: boolean;
  /** Opened from a notification: scroll to it and outline it briefly. */
  highlighted?: boolean;
  onOpenField: () => void;
  /** Called once an answer is saved. */
  onAnswered?: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "correcting" | "changing">("idle");
  const isPhone = useIsPhone();
  const [correction, setCorrection] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  // Plays a short fade-out before the answer is applied, so the card
  // visibly leaves this section instead of vanishing. It then rises into
  // the other section (cards enter with .m-in).
  const [leaving, setLeaving] = useState(false);
  const answer = (accurate: boolean) => {
    if (alert.status !== "open" || reducedMotion()) {
      mutation.mutate(accurate);
      return;
    }
    setLeaving(true);
    setTimeout(() => mutation.mutate(accurate), 160);
  };
  const ref = useRef<HTMLElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  const mutation = useMutation<"reviewed" | "dismissed", Error, boolean, { previous?: FieldAlert[] }>({
    mutationFn: (accurate) =>
      submitAlertFeedback({ anomalyId: alert.anomaly_id, alertId: alert.id, farmerId: alert.farmer_id, accurate, correction }),
    // The answer shows straight away and is put back if saving fails.
    onMutate: async (accurate) => {
      await queryClient.cancelQueries({ queryKey: ALERTS_KEY });
      const previous = queryClient.getQueryData<FieldAlert[]>(ALERTS_KEY);
      queryClient.setQueryData<FieldAlert[]>(ALERTS_KEY, (old) =>
        (old ?? []).map((a) => (a.id === alert.id ? { ...a, viewed: true, status: accurate ? "reviewed" : "dismissed" } : a)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      setLeaving(false);
      if (ctx?.previous) queryClient.setQueryData(ALERTS_KEY, ctx.previous);
    },
    onSuccess: () => {
      setMode("idle");
      setCorrection("");
      setJustSaved(true);
      onAnswered?.();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["fieldDetail", alert.field_id] });
    },
  });

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 3000);
    return () => clearTimeout(t);
  }, [justSaved]);

  const status = STATUS[alert.status] ?? STATUS.open;
  const cause = causeText(alert.cause_type, alert.confidence_pct);
  const asking = alert.status === "open" || mode === "changing";

  return (
    <article
      ref={ref}
      aria-labelledby={`alert-${alert.id}-title`}
      className={`${leaving ? "m-out" : "m-in"} -mx-3 rounded-lg border-b border-canopy-900/5 px-3 py-4 last:border-0 dark:border-white/5 ${
        highlighted ? "bg-growth-50 ring-2 ring-growth-500/40 dark:bg-white/5" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {isNew && (
          <span className="flex items-center gap-1 text-xs font-semibold text-laterite-700">
            <span className="h-2 w-2 rounded-full bg-laterite-600" aria-hidden />
            New
          </span>
        )}
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${SEVERITY_STYLE[alert.severity]}`}>
          {SEVERITY_LABEL[alert.severity]}
        </span>
        <h3 id={`alert-${alert.id}-title`} className="text-sm font-semibold">
          <button
            onClick={onOpenField}
            className="inline-flex min-h-11 min-w-11 items-center text-base md:min-w-0 text-ink hover:text-growth-700 hover:underline dark:text-parchment dark:hover:text-growth-500 md:min-h-0 md:text-sm"
            title={`Open ${alert.field_name}`}
          >
            {alert.field_name}
          </button>
        </h3>
        <span className="text-xs text-ink/65 dark:text-parchment/65">{formatAlertDate(alert.date_detected)}</span>
        <span className={`basis-full rounded-full px-2 py-1 text-xs font-medium sm:ml-auto sm:basis-auto ${status.cls} w-fit`}>{status.text}</span>
      </div>

      {cause && <p className="mt-3 text-xs font-medium text-ink/70 dark:text-parchment/70">{cause}</p>}
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink/85 dark:text-parchment/85">{alert.message_text}</p>

      {asking && mode !== "correcting" && (
        <div
          className="mt-3 grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center"
          role="group"
          aria-label={`Was the alert for ${alert.field_name} right?`}
        >
          <span className="col-span-2 text-sm text-ink/70 dark:text-parchment/70 md:text-xs md:text-ink/65 md:dark:text-parchment/65">Was this right?</span>
          <button
            onClick={() => answer(true)}
            disabled={mutation.isPending}
            className={`${smallButton} bg-growth-50 text-growth-700 hover:bg-growth-100`}
          >
            <span className="md:hidden">Yes, that's right</span>
            <span className="hidden md:inline">Yes, that's what happened</span>
          </button>
          <button
            onClick={() => setMode("correcting")}
            disabled={mutation.isPending}
            className={`${smallButton} border border-canopy-900/15 text-ink/80 hover:bg-parchment dark:border-white/15 dark:text-parchment/80 dark:hover:bg-white/5`}
          >
            <span className="md:hidden">Something else</span>
            <span className="hidden md:inline">No, something else</span>
          </button>
          {mode === "changing" && (
            <button onClick={() => setMode("idle")} className={`${smallButton} col-span-2 text-ink/65 hover:text-ink dark:text-parchment/65`}>
              Cancel
            </button>
          )}
          {mutation.isPending && (
            <span className="col-span-2 text-xs text-ink/65 dark:text-parchment/65" role="status">
              Saving…
            </span>
          )}
        </div>
      )}

      {/* Phones: the answer box opens in a bottom sheet. */}
      {isPhone && (
        <Modal
          open={mode === "correcting"}
          onClose={() => !mutation.isPending && setMode(alert.status === "open" ? "idle" : "changing")}
          title="What actually happened?"
          description={`Tell Growell what you found in ${alert.field_name}. It helps the next alerts be more accurate.`}
        >
          <form
            className="pb-[calc(16px+env(safe-area-inset-bottom,0px))]"
            onSubmit={(e) => {
              e.preventDefault();
              if (correction.trim()) answer(false);
            }}
          >
            <label htmlFor={`correction-sheet-${alert.id}`} className="sr-only">
              What actually happened in this field?
            </label>
            <textarea
              id={`correction-sheet-${alert.id}`}
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              placeholder="For example: armyworms on the lower leaves, or the field was flooded"
              maxLength={500}
              rows={4}
              disabled={mutation.isPending}
              data-autofocus
              enterKeyHint="send"
              className="w-full rounded-lg border border-canopy-900/15 bg-transparent px-3 py-3 text-base focus:border-growth-500 focus:outline-none focus:ring-[3px] focus:ring-growth-500/15 disabled:opacity-50 dark:border-white/15"
            />
            <button
              type="submit"
              disabled={mutation.isPending || !correction.trim()}
              className="mt-3 h-12 w-full rounded-lg bg-growth-600 text-base font-semibold text-white active:bg-growth-700 disabled:opacity-50"
            >
              <BusyLabel busy={mutation.isPending} label="Send answer" busyLabel="Sending…" />
            </button>
            {mutation.isError && (
              <p className="mt-2 text-sm text-laterite-700" role="alert">
                {mutation.error.message}
              </p>
            )}
          </form>
        </Modal>
      )}

      {mode === "correcting" && !isPhone && (
        <form
          className="mt-3 flex max-w-xl flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (correction.trim()) answer(false);
          }}
        >
          <label htmlFor={`correction-${alert.id}`} className="sr-only">
            What actually happened in this field?
          </label>
          <input
            id={`correction-${alert.id}`}
            type="text"
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="What actually happened in this field?"
            maxLength={500}
            disabled={mutation.isPending}
            autoFocus
            className="h-8 min-w-0 flex-1 rounded-md border border-canopy-900/15 bg-transparent px-3 text-sm focus:border-growth-500 focus:outline-none focus:ring-[3px] focus:ring-growth-500/15 disabled:opacity-50 dark:border-white/15"
          />
          <button
            type="button"
            onClick={() => setMode(alert.status === "open" ? "idle" : "changing")}
            disabled={mutation.isPending}
            className={`${smallButton} text-ink/65 hover:text-ink dark:text-parchment/65`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !correction.trim()}
            className={`${smallButton} bg-growth-600 text-white hover:bg-growth-700`}
          >
            <BusyLabel busy={mutation.isPending} label="Send" busyLabel="Sending…" />
          </button>
        </form>
      )}

      {alert.status !== "open" && mode === "idle" && (
        <div className="mt-3 flex items-center gap-3">
          {justSaved ? (
            <span className="text-xs font-medium text-growth-700" role="status">
              Thanks, your answer is saved.
            </span>
          ) : (
            <button
              onClick={() => setMode("changing")}
              className="-ml-3 h-11 rounded-lg px-3 text-sm font-medium text-ink/70 underline-offset-2 hover:text-ink hover:underline active:bg-parchment dark:text-parchment/70 dark:hover:text-parchment dark:active:bg-white/5 md:ml-0 md:h-auto md:px-0 md:text-xs md:text-ink/65 md:dark:text-parchment/65"
            >
              Change your answer
            </button>
          )}
        </div>
      )}

      {mutation.isError && (
        <p className="mt-2 text-xs text-laterite-700" role="alert">
          {mutation.error.message}
        </p>
      )}
    </article>
  );
}
