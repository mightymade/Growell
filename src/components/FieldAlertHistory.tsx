import { useNavigate } from "react-router-dom";
import type { AlertWithRecommendation } from "../lib/types";
import { formatAlertDate, SEVERITY_STYLE as severityStyle, SEVERITY_LABEL } from "../lib/alertText";

const MAX_ROWS = 4;

/**
 * Short history of one field's alerts for the field page. Reading an
 * alert in full and answering it happens on the Alerts page; each row
 * and the link go there, already filtered to this field.
 */
export default function FieldAlertHistory({ alerts, fieldId }: { alerts: AlertWithRecommendation[]; fieldId: string }) {
  const navigate = useNavigate();
  const toAlerts = () => navigate(`/alerts?field=${fieldId}`);
  const open = alerts.filter((a) => a.status === "open").length;

  return (
    <div className="rounded-xl bg-white p-4 shadow-e1 dark:bg-night-900">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-sm font-semibold text-ink dark:text-parchment">Alert history</p>
        {alerts.length > 0 && (
          <button
            onClick={toAlerts}
            className="-my-3 -mr-3 flex h-11 items-center rounded-lg px-3 text-sm font-medium text-growth-700 hover:underline active:bg-growth-50 dark:text-growth-500 md:-my-0 md:-mr-0 md:h-auto md:px-0 md:text-xs"
          >
            {open > 0 ? `Answer ${open} in Alerts` : "Open in Alerts"}
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <p className="mt-2 text-sm text-ink/70 dark:text-parchment/70">
          No drops detected on this field so far. Crop health is tracking its usual level.
        </p>
      ) : (
        <ul className="m-stagger mt-3 divide-y divide-canopy-900/5 dark:divide-white/5">
          {alerts.slice(0, MAX_ROWS).map((a) => (
            <li key={a.id}>
              <button
                onClick={() => navigate(`/alerts?field=${fieldId}&alert=${a.id}`)}
                className="flex min-h-12 w-full items-center gap-3 py-3 text-left hover:bg-parchment/60 active:bg-parchment dark:hover:bg-white/5 dark:active:bg-white/5"
              >
                <span className={`w-[72px] shrink-0 rounded-full py-1 text-center text-xs font-medium ${severityStyle[a.severity]}`}>
                  {SEVERITY_LABEL[a.severity]}
                </span>
                <span className="w-24 shrink-0 text-xs text-ink/65 dark:text-parchment/65">{formatAlertDate(a.date_detected)}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink/85 dark:text-parchment/85">{a.message_text}</span>
                {a.status === "open" && <span className="h-2 w-2 shrink-0 rounded-full bg-laterite-600" aria-label="Needs your answer" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {alerts.length > MAX_ROWS && (
        <p className="mt-2 text-xs text-ink/65 dark:text-parchment/65">
          {alerts.length - MAX_ROWS} older alert{alerts.length - MAX_ROWS === 1 ? "" : "s"} on the Alerts page.
        </p>
      )}
    </div>
  );
}
