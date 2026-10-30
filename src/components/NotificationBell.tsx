import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAllFieldAlerts, type FieldAlert } from "../hooks/useAllFieldAlerts";
import { useMarkAlertsViewed } from "../hooks/useMarkAlertsViewed";
import { SEVERITY_DOT, SEVERITY_LABEL, timeAgo } from "../lib/alertText";
import { BellIcon, CheckIcon } from "./icons";

const SHOWN = 8;

/**
 * The bell and its notification panel. The badge counts unread alerts.
 * The panel lists the newest alerts with unread ones marked; opening one
 * marks it read and goes to it on the Alerts page. "Mark all as read"
 * clears the badge without leaving the page.
 *
 * Keyboard: Enter or Space opens, Escape closes and returns focus to the
 * bell, Tab moves through the items. Clicking outside also closes it.
 */
export default function NotificationBell({ tone = "light" }: { tone?: "light" | "onDark" }) {
  const navigate = useNavigate();
  const { alerts, loading } = useAllFieldAlerts();
  const markViewed = useMarkAlertsViewed();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelId = useId();

  const unread = alerts.filter((a) => !a.viewed && a.status === "open");
  const toAnswer = alerts.filter((a) => a.status === "open").length;
  const items = alerts.slice(0, SHOWN);

  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        bellRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  function openAlert(a: FieldAlert) {
    if (!a.viewed) markViewed.mutate([a.id]);
    setOpen(false);
    navigate(`/alerts?field=${a.field_id}&alert=${a.id}`);
  }

  const bellClass =
    tone === "onDark"
      ? "text-parchment hover:bg-white/10"
      : "bg-white text-ink/70 shadow-e1 hover:text-ink dark:bg-night-900 dark:text-parchment/70 dark:hover:text-parchment";

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={bellRef}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread.length > 0 ? `Notifications, ${unread.length} new` : "Notifications"}
        className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-growth-600 ${bellClass}`}
      >
        <BellIcon size={18} />
        {unread.length > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-laterite-600 px-1 text-xs font-bold leading-none text-white ring-2 ring-white dark:ring-night-900"
          >
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-labelledby={`${panelId}-title`}
          className="m-drop fixed inset-x-4 top-16 origin-top sm:origin-top-right z-[900] flex max-h-[70vh] flex-col overflow-hidden rounded-xl bg-white shadow-e2 ring-1 ring-canopy-900/10 dark:bg-night-900 dark:ring-white/10 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-canopy-900/5 px-4 py-3 dark:border-white/5">
            <div>
              <h2
                ref={headingRef}
                id={`${panelId}-title`}
                tabIndex={-1}
                className="font-display text-base font-semibold text-ink outline-none dark:text-parchment"
              >
                Notifications
              </h2>
              <p className="text-xs text-ink/65 dark:text-parchment/65">
                {toAnswer > 0 ? `${toAnswer} waiting for your answer` : "Nothing waiting for your answer"}
              </p>
            </div>
            {unread.length > 0 && (
              <button
                onClick={() => markViewed.mutate(unread.map((a) => a.id))}
                className="h-8 rounded-md px-2 text-xs font-medium text-growth-700 hover:bg-growth-50 dark:text-growth-500 dark:hover:bg-white/5"
              >
                Mark all as read
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3 p-4" aria-label="Loading notifications">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-parchment dark:bg-white/5" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-growth-100 text-growth-700">
                <CheckIcon size={20} />
              </span>
              <p className="text-sm font-semibold text-ink dark:text-parchment">All clear</p>
              <p className="mt-1 text-sm text-ink/65 dark:text-parchment/65">
                Growell checks your fields every day and lets you know here if crop health drops.
              </p>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto py-1">
              {items.map((a) => {
                const isUnread = !a.viewed && a.status === "open";
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => openAlert(a)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-parchment focus-visible:bg-parchment focus-visible:outline-none dark:hover:bg-white/5 dark:focus-visible:bg-white/5 ${
                        isUnread ? "bg-laterite-50/50 dark:bg-white/[0.03]" : ""
                      }`}
                    >
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[a.severity]}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={`truncate text-sm text-ink dark:text-parchment ${isUnread ? "font-semibold" : "font-medium"}`}>
                            {a.field_name}
                          </span>
                          <span className="shrink-0 text-xs text-ink/65 dark:text-parchment/65">{timeAgo(a.date_sent)}</span>
                        </span>
                        <span className="mt-1 line-clamp-2 text-sm text-ink/70 dark:text-parchment/70">{a.message_text}</span>
                        <span className="sr-only">
                          {SEVERITY_LABEL[a.severity]} alert. {isUnread ? "New." : ""} {a.status === "open" ? "Needs your answer." : "Answered."}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-canopy-900/5 p-2 dark:border-white/5">
            <button
              onClick={() => {
                setOpen(false);
                navigate("/alerts");
              }}
              className="h-10 w-full rounded-lg text-sm font-semibold text-growth-700 hover:bg-parchment dark:text-growth-500 dark:hover:bg-white/5"
            >
              View all alerts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
