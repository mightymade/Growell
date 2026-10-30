import type { FieldAlert } from "../hooks/useAllFieldAlerts";
import { BellIcon, CheckIcon } from "./icons";
import { SEVERITY_LABEL, timeAgo } from "../lib/alertText";

const STATUS_LABEL: Record<string, string> = { reviewed: "Confirmed", dismissed: "Said wrong" };

const TILE: Record<string, string> = {
  low: "bg-sky-100 text-sky-700",
  moderate: "bg-laterite-100 text-laterite-700",
  high: "bg-laterite-700 text-white",
};
const BADGE: Record<string, string> = {
  low: "bg-sky-100 text-sky-700",
  moderate: "bg-laterite-100 text-laterite-700",
  high: "bg-laterite-700 text-white",
};

type Props = {
  alerts: FieldAlert[];
  openCount: number;
  onOpenAlert: (alert: FieldAlert) => void;
  onViewAll: () => void;
};

/**
 * The latest alerts across all fields. When there are none, the card
 * shows a centered "all clear" instead of a line of text and empty space.
 */
export default function RecentAlertsCard({ alerts, openCount, onOpenAlert, onViewAll }: Props) {
  return (
    <section className="flex flex-col rounded-xl bg-white dark:bg-night-900 p-5 shadow-e1">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-sm font-semibold text-ink dark:text-parchment">Recent alerts</p>
        {openCount > 0 && (
          <span className="rounded-full bg-laterite-100 px-3 py-1 text-xs font-semibold text-laterite-700">
            {openCount} to answer
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <div className="relative mb-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-growth-100 text-growth-700">
              <BellIcon size={28} />
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-growth-600 text-white ring-2 ring-white">
              <CheckIcon size={13} />
            </span>
          </div>
          <p className="font-display text-base font-semibold text-ink dark:text-parchment">All clear</p>
          <p className="mt-1 max-w-[16rem] text-sm text-ink/70 dark:text-parchment/70">
            Nothing needs your attention right now. Growell checks your fields every day.
          </p>
        </div>
      ) : (
        <>
          <div className="m-stagger mt-3 divide-y divide-canopy-900/5 dark:divide-white/5">
            {alerts.map((a) => {
              const closed = a.status !== "open";
              return (
                <button
                  key={a.id}
                  onClick={() => onOpenAlert(a)}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left hover:bg-parchment dark:hover:bg-white/5"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      closed ? "bg-parchment dark:bg-night-950 text-ink/70 dark:text-parchment/70" : TILE[a.severity]
                    }`}
                  >
                    <BellIcon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink dark:text-parchment">{a.field_name}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-ink/70 dark:text-parchment/70">
                        {!a.viewed && !closed && (
                          <span className="flex items-center gap-1 font-semibold text-laterite-700">
                            <span className="h-2 w-2 rounded-full bg-laterite-600" aria-hidden />
                            New
                          </span>
                        )}
                        {timeAgo(a.date_sent)}
                      </span>
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs text-ink/70 dark:text-parchment/70">{a.message_text}</span>
                    <span className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${BADGE[a.severity]}`}>{SEVERITY_LABEL[a.severity]}</span>
                      {closed && (
                        <span className="rounded-full bg-parchment dark:bg-night-950 px-2 py-1 text-xs font-semibold text-ink/70 dark:text-parchment/70">{STATUS_LABEL[a.status] ?? a.status}</span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={onViewAll}
            className="mt-auto rounded-lg border border-canopy-900/15 dark:border-white/15 py-3 text-sm font-semibold text-growth-700 hover:bg-parchment dark:hover:bg-white/5"
          >
            View all alerts
          </button>
        </>
      )}
    </section>
  );
}
