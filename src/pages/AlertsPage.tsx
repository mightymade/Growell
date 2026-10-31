import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { useAllFieldAlerts } from "../hooks/useAllFieldAlerts";
import { useMarkAlertsViewed } from "../hooks/useMarkAlertsViewed";
import type { LayoutContext } from "../components/AppLayout";
import AlertCard from "../components/AlertCard";
import AlertBreakdownDonut from "../components/AlertBreakdownDonut";
import { BellIcon } from "../components/icons";
import { AlertsSkeleton } from "../components/Skeleton";

/**
 * Every alert from every field, in one place. This is where the farmer
 * reads what was detected, its likely cause and what to do, and answers
 * whether it was right. Filter by field with the chips at the top; a
 * field page links here already filtered to that field (?field=<id>).
 *
 * Opening the page marks the alerts it shows as read, which clears the red
 * counts. They still carry a "New" label for the rest of this visit, so
 * the farmer can tell what just arrived. A notification links here with
 * ?alert=<id>, which scrolls to that alert and outlines it.
 */
export default function AlertsPage() {
  const navigate = useNavigate();
  const { fields } = useOutletContext<LayoutContext>();
  const { alerts, loading } = useAllFieldAlerts();
  const [params, setParams] = useSearchParams();
  const fieldFilter = params.get("field");
  const targetAlert = params.get("alert");
  const markViewed = useMarkAlertsViewed();
  // Alerts that were unread when they first appeared on this visit.
  const [newThisVisit, setNewThisVisit] = useState<Set<string>>(() => new Set());
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const marking = useRef(false);

  const shown = useMemo(
    () => (fieldFilter ? alerts.filter((a) => a.field_id === fieldFilter) : alerts),
    [alerts, fieldFilter],
  );
  const open = shown.filter((a) => a.status === "open");
  const past = shown.filter((a) => a.status !== "open");
  const filterName = fields.find((f) => f.id === fieldFilter)?.field_name;

  // Mark what is on screen as read, once per batch. Runs again if a new
  // alert arrives while the page is open.
  useEffect(() => {
    if (loading || marking.current) return;
    const unread = shown.filter((a) => !a.viewed).map((a) => a.id);
    if (unread.length === 0) return;
    setNewThisVisit((prev) => new Set([...prev, ...unread]));
    marking.current = true;
    markViewed.mutate(unread, { onSettled: () => (marking.current = false) });
  }, [loading, shown, markViewed]);

  useEffect(() => {
    if (!savedNotice) return;
    const t = setTimeout(() => setSavedNotice(null), 4000);
    return () => clearTimeout(t);
  }, [savedNotice]);

  // Only fields that have alerts get a chip, so there are no dead ends.
  const fieldsWithAlerts = fields.filter((f) => alerts.some((a) => a.field_id === f.id));

  if (loading) return <AlertsSkeleton />;

  const setFilter = (id: string | null) => {
    if (id) setParams({ field: id }, { replace: true }); // also drops ?alert
    else setParams({}, { replace: true });
  };

  return (
    <div>
      <header className="mb-5">
        <h1 className="hidden font-display text-2xl font-semibold tracking-tight text-ink dark:text-parchment md:block">Alerts</h1>
        <p className="text-sm md:mt-1 text-ink/70 dark:text-parchment/70">
          {open.length > 0
            ? `${open.length} alert${open.length === 1 ? "" : "s"} waiting for your answer${filterName ? ` on ${filterName}` : ""}.`
            : `Nothing waiting for your answer${filterName ? ` on ${filterName}` : ""}.`}
        </p>
      </header>

      {fieldsWithAlerts.length > 1 && (
        // Phones: one sideways-scrolling row of chips, with a fade at the
        // right edge when more continue. Computers: chips wrap as before.
        <div className="relative mb-5">
        <div
          className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filter by field"
        >
          {[{ id: null as string | null, name: "All fields" }, ...fieldsWithAlerts.map((f) => ({ id: f.id, name: f.field_name }))].map(
            (opt) => {
              const active = (opt.id ?? null) === (fieldFilter ?? null);
              return (
                <button
                  key={opt.id ?? "all"}
                  onClick={() => setFilter(opt.id)}
                  aria-pressed={active}
                  className={`h-11 shrink-0 snap-start rounded-full px-4 text-sm transition active:scale-[0.98] md:h-auto md:px-3 md:py-2 ${
                    active
                      ? "bg-ink text-white dark:bg-parchment dark:text-ink"
                      : "bg-white text-ink/70 hover:text-ink dark:bg-night-900 dark:text-parchment/70 dark:hover:text-parchment"
                  }`}
                >
                  {opt.name}
                </button>
              );
            },
          )}
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 -right-4 w-8 bg-gradient-to-l from-parchment to-transparent dark:from-night-950 md:hidden" />
        </div>
      )}

      <p role="status" className={savedNotice ? "mb-4 rounded-lg bg-growth-50 px-4 py-3 text-sm text-growth-700" : "sr-only"}>
        {savedNotice ?? ""}
      </p>

      {shown.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-xl border border-dashed border-canopy-900/20 bg-white p-10 text-center dark:border-white/20 dark:bg-night-900">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-growth-100 text-growth-700">
            <BellIcon size={22} />
          </span>
          <p className="mb-1 font-display font-semibold text-ink dark:text-parchment">No alerts{filterName ? ` for ${filterName}` : ""}</p>
          <p className="max-w-sm text-sm text-ink/70 dark:text-parchment/70">
            Growell raises an alert when a field's crop health drops well below its own usual level.
          </p>
          {fieldFilter && (
            <button onClick={() => setFilter(null)} className="mt-4 h-11 rounded-lg px-4 text-sm font-medium text-growth-700 active:bg-growth-50 dark:text-growth-500 md:h-auto md:px-0">
              Show all fields
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Phones: the counts in one short row instead of the donut. */}
          <dl className="grid grid-cols-3 gap-2 md:hidden">
            {[
              { label: "To answer", value: open.length, tone: open.length > 0 ? "text-laterite-700 dark:text-laterite-600" : "text-ink dark:text-parchment" },
              { label: "Answered", value: past.length, tone: "text-ink dark:text-parchment" },
              { label: "Total", value: shown.length, tone: "text-ink dark:text-parchment" },
            ].map((c) => (
              <div key={c.label} className="flex flex-col-reverse rounded-xl bg-white px-3 py-3 shadow-e1 dark:bg-night-900">
                <dt className="text-xs text-ink/70 dark:text-parchment/70">{c.label}</dt>
                <dd className={`text-xl font-semibold tabular-nums ${c.tone}`}>{c.value}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-4 lg:col-span-2">
            {open.length > 0 && (
              <section className="rounded-xl bg-white p-4 shadow-e1 dark:bg-night-900 md:p-5">
                <h2 className="mb-4 font-display text-sm font-semibold text-ink dark:text-parchment">
                  Waiting for your answer ({open.length})
                </h2>
                {open.map((a) => (
                  <AlertCard
                    key={a.id}
                    alert={a}
                    isNew={newThisVisit.has(a.id)}
                    highlighted={a.id === targetAlert}
                    onOpenField={() => navigate(`/fields/${a.field_id}`)}
                    onAnswered={() => setSavedNotice(`Answer saved for ${a.field_name}. Thank you, this helps Growell get more accurate.`)}
                  />
                ))}
              </section>
            )}
            {past.length > 0 && (
              <section className="rounded-xl bg-white p-4 shadow-e1 dark:bg-night-900 md:p-5">
                <h2 className="mb-4 font-display text-sm font-semibold text-ink dark:text-parchment">Answered</h2>
                {past.map((a) => (
                  <AlertCard
                    key={a.id}
                    alert={a}
                    isNew={newThisVisit.has(a.id)}
                    highlighted={a.id === targetAlert}
                    onOpenField={() => navigate(`/fields/${a.field_id}`)}
                    onAnswered={() => setSavedNotice(`Answer saved for ${a.field_name}. Thank you, this helps Growell get more accurate.`)}
                  />
                ))}
              </section>
            )}
          </div>
          <div className="hidden md:block">
            <AlertBreakdownDonut alerts={shown} title={filterName ? `${filterName} at a glance` : "At a glance"} />
          </div>
        </div>
      )}
    </div>
  );
}
