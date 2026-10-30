import type { FieldAlert } from "../hooks/useAllFieldAlerts";

const severityStyle: Record<string, string> = {
  low: "bg-sky-100 text-sky-700",
  moderate: "bg-laterite-100 text-laterite-700",
  high: "bg-laterite-700 text-white",
};

/**
 * The bell's quick-glance popup — open recommendations only, read-only,
 * across every field (lives on Home now, not a single field's page).
 * For confirming/correcting an alert, that's done on the Alerts page (AlertCard), not
 * that field's own detail view — this is "what needs attention right
 * now," not a full history view.
 */
export default function RecommendationsList({ alerts }: { alerts: FieldAlert[] }) {
  const open = alerts.filter((a) => a.status === "open");

  if (open.length === 0) {
    return <p className="text-sm text-ink/70 dark:text-parchment/70">No open recommendations right now — all your fields are tracking normally.</p>;
  }

  return (
    <div className="space-y-3">
      {open.map((a) => (
        <div key={a.id} className="flex items-start gap-3 border-b border-canopy-900/5 dark:border-white/5 pb-3 last:border-0 last:pb-0">
          <span className={`mt-1 shrink-0 rounded-full px-2 py-1 text-xs font-medium ${severityStyle[a.severity]}`}>
            {a.severity}
          </span>
          <div>
            <p className="text-xs text-ink/70 dark:text-parchment/70">
              <span className="font-medium text-ink dark:text-parchment">{a.field_name}</span> · {a.date_detected}
            </p>
            <p className="mt-1 text-sm text-ink/80 dark:text-parchment/80">{a.message_text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
