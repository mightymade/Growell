import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useIsPhone } from "../../hooks/useIsPhone";
import { adminApi, type AuditFilters } from "../api";
import { ACTION_GROUPS, describeText, actionInfo } from "../events";
import { FitEventList } from "../EventList";
import { downloadCsv, fullDate, todayStamp } from "../format";
import { EmptyState, ErrorState, InfoTip, PageHeader, SearchBox, btnGhost, btnSecondary, card, inputClass, useUrlState } from "../ui";
import Select from "../../components/Select";
import { Skeleton, LoadingRegion } from "../../components/Skeleton";
import { BusyLabel } from "../../components/Busy";
import { ChevronDownIcon, CloseIcon, DownloadIcon } from "../../components/icons";

const RANGES = [
  { value: "", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom dates" },
];


function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Turns the URL's date choice into a from/to pair the database understands. */
function rangeToDates(range: string, from: string, to: string): { from: string | null; to: string | null } {
  const today = startOfDay(new Date());
  if (range === "today") return { from: today.toISOString(), to: null };
  if (range === "7d") return { from: new Date(today.getTime() - 6 * 86_400_000).toISOString(), to: null };
  if (range === "30d") return { from: new Date(today.getTime() - 29 * 86_400_000).toISOString(), to: null };
  if (range === "custom") {
    const f = from ? new Date(`${from}T00:00:00`) : null;
    // "To" includes the whole of that day.
    const t = to ? new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000) : null;
    return { from: f ? f.toISOString() : null, to: t ? t.toISOString() : null };
  }
  return { from: null, to: null };
}

export default function ActivityPage() {
  const url = useUrlState();
  const user = url.get("user");
  const userName = url.get("uname");
  const actions = url.get("actions") ? url.get("actions").split(",") : [];
  const search = url.get("q");
  const range = url.get("range");
  const fromDay = url.get("from");
  const toDay = url.get("to");
  const dates = rangeToDates(range, fromDay, toDay);
  const filters: AuditFilters = { actor: user || null, actions, search, from: dates.from, to: dates.to };
  const anyFilter = !!(user || actions.length || search || range);

  // Pages: each page starts right after the last event the previous page
  // showed. We remember where each page started, so Previous goes back
  // exactly. How many events a page holds depends on how many fit on screen.
  const filterKey = JSON.stringify(filters);
  const [pages, setPages] = useState<{ cursor: { time: string; id: number } | null; offset: number }[]>([{ cursor: null, offset: 0 }]);
  const [pageIndex, setPageIndex] = useState(0);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setPages([{ cursor: null, offset: 0 }]);
    setPageIndex(0);
  }, [filterKey]);
  const page = pages[pageIndex] ?? pages[0];
  const isPhone = useIsPhone();

  const q = useQuery({
    queryKey: ["admin", "audit", "page", filterKey, page.cursor?.id ?? 0, page.cursor?.time ?? ""],
    queryFn: () => adminApi.audit(filters, page.cursor, isPhone ? 20 : 40),
    placeholderData: keepPreviousData,
  });
  const events = useMemo(() => q.data?.rows ?? [], [q.data]);
  const total = useQuery({ queryKey: ["admin", "audit", "count", filterKey], queryFn: () => adminApi.auditCount(filters) });
  const hasNext = shown < events.length || !!q.data?.has_more;

  function next() {
    const last = events[shown - 1];
    if (!last) return;
    setPages((ps) => [...ps.slice(0, pageIndex + 1), { cursor: { time: last.occurred_at, id: last.id }, offset: page.offset + shown }]);
    setPageIndex((i) => i + 1);
  }

  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: adminApi.overview });
  const logStarted = overview.data?.log_started ?? null;

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const { rows, has_more } = await adminApi.audit(filters, null, 10000);
      downloadCsv(
        `growell-activity-${todayStamp()}.csv`,
        ["Time (UTC)", "Local time", "Action", "What happened", "User name", "User email", "Item type", "Item ID", "Item name", "Recorded by", "Details"],
        rows.map((e) => [
          e.occurred_at,
          new Date(e.occurred_at).toLocaleString("en-GB"),
          actionInfo(e.action).label,
          describeText(e),
          e.actor_name,
          e.actor_email,
          e.entity_type,
          e.entity_id,
          e.entity_name,
          e.source,
          JSON.stringify(e.details ?? {}),
        ]),
      );
      if (has_more) setExportError("Only the newest 10,000 events were exported. Narrow the filters to export the rest.");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Couldn't export. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col tall:h-full tall:min-h-0">
      <PageHeader
        title="Activity"
        description="Everything users did, and what the daily satellite check reported. Nothing here can be changed or deleted."
        actions={
          <button type="button" className={btnSecondary} onClick={exportCsv} disabled={exporting || events.length === 0}>
            <DownloadIcon />
            <BusyLabel busy={exporting} label="Export CSV" busyLabel="Exporting…" />
          </button>
        }
      />

      <div className="mb-4 flex shrink-0 flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <UserPicker
          id={user}
          name={userName}
          onChange={(id, name) => url.set({ user: id, uname: name })}
        />
        <ActionPicker value={actions} onChange={(v) => url.set({ actions: v.length ? v.join(",") : null })} />
        <div className="lg:w-44">
          <Select options={RANGES} value={range} onChange={(v) => url.set({ range: v, from: null, to: null })} ariaLabel="Date range" />
        </div>
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" aria-label="From date" className={`${inputClass} lg:w-40`} value={fromDay} max={toDay || undefined} onChange={(e) => url.set({ from: e.target.value })} />
            <span className="text-sm text-ink/60 dark:text-parchment/60">to</span>
            <input type="date" aria-label="To date" className={`${inputClass} lg:w-40`} value={toDay} min={fromDay || undefined} onChange={(e) => url.set({ to: e.target.value })} />
          </div>
        )}
        <SearchBox value={search} onChange={(v) => url.set({ q: v })} placeholder="Field name, field ID or email" label="Search activity" />
        {anyFilter && (
          <button type="button" className={btnGhost} onClick={() => url.set({ user: null, uname: null, actions: null, q: null, range: null, from: null, to: null })}>
            Clear filters
          </button>
        )}
      </div>

      {exportError && (
        <p role="alert" className="mb-4 shrink-0 rounded-lg bg-laterite-50 px-3 py-2 text-sm text-laterite-700">
          {exportError}
        </p>
      )}

      {q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <LoadingRegion label="Loading activity">
          <div className={`${card} space-y-4 p-6`}>
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </LoadingRegion>
      ) : events.length === 0 ? (
        <div className={card}>
          <EmptyState
            title={anyFilter ? "No activity matches these filters." : "Nothing has been recorded yet."}
            action={
              anyFilter ? (
                <button className={btnGhost} onClick={() => url.set({ user: null, uname: null, actions: null, q: null, range: null, from: null, to: null })}>
                  Clear filters
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <section aria-labelledby="activity-list-title" className={`${card} flex min-h-0 flex-col overflow-hidden tall:grow tall:basis-0 ${q.isPlaceholderData ? "opacity-60 transition-opacity" : ""}`}>
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-1 pt-4 md:px-6 tall:px-4">
            <h2 id="activity-list-title" className="text-base font-semibold text-ink dark:text-parchment">
              Newest first
            </h2>
            <InfoTip
              align="right"
              label="About this list"
              text={
                logStarted
                  ? `Recording started on ${fullDate(logStarted)}. Earlier account and field events are reconstructed from their dates; earlier sign-ins can't be recovered. Nothing in this list can be changed or deleted.`
                  : "Nothing in this list can be changed or deleted."
              }
            />
          </div>
          <FitEventList events={events} onFit={setShown} />
          <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-canopy-900/5 px-4 py-3 dark:border-white/5 md:flex-row">
            <p className="text-sm text-ink/70 dark:text-parchment/70" aria-live="polite">
              {shown > 0 &&
                `Showing ${(page.offset + 1).toLocaleString("en-GB")} to ${(page.offset + shown).toLocaleString("en-GB")}${
                  total.data !== undefined && total.data !== null ? ` of ${total.data.toLocaleString("en-GB")}` : ""
                } events`}
            </p>
            <div className="flex gap-2">
              <button type="button" className={btnSecondary} disabled={pageIndex === 0 || q.isFetching} onClick={() => setPageIndex((i) => Math.max(0, i - 1))}>
                Previous
              </button>
              <button type="button" className={btnSecondary} disabled={!hasNext || q.isFetching} onClick={next}>
                Next
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ---- Filters -------------------------------------------------------------------

/** A popover that closes on outside click and Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, root };
}

const triggerClass =
  "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-canopy-900/12 bg-white px-3 text-left text-sm text-ink transition-colors hover:border-canopy-900/25 focus:border-growth-500 focus:outline-none focus:ring-[3px] focus:ring-growth-500/15 dark:border-white/15 dark:bg-night-950 dark:text-parchment dark:hover:border-white/25 max-md:h-12";
const panelClass =
  "m-drop absolute left-0 top-full z-50 mt-1 w-full min-w-[260px] rounded-lg border border-canopy-900/10 bg-white p-2 shadow-e2 dark:border-white/10 dark:bg-night-900";

function ActionPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { open, setOpen, root } = usePopover();
  const label = value.length === 0 ? "All actions" : value.length === 1 ? actionInfo(value[0]).label : `${value.length} actions`;
  const toggle = (a: string) => onChange(value.includes(a) ? value.filter((x) => x !== a) : [...value, a]);
  const toggleGroup = (actions: string[]) => {
    const all = actions.every((a) => value.includes(a));
    onChange(all ? value.filter((a) => !actions.includes(a)) : [...new Set([...value, ...actions])]);
  };

  return (
    <div ref={root} className="relative lg:w-48">
      <button type="button" className={triggerClass} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={`truncate ${value.length ? "" : "text-ink/65 dark:text-parchment/65"}`}>{label}</span>
        <ChevronDownIcon size={14} />
      </button>
      {open && (
        <div className={`${panelClass} max-h-[60vh] overflow-y-auto`} role="group" aria-label="Action types">
          {ACTION_GROUPS.map((g) => {
            const acts = g.actions.map((a) => a.action);
            const all = acts.every((a) => value.includes(a));
            return (
              <fieldset key={g.group} className="mb-2 last:mb-0">
                <legend className="w-full">
                  <button
                    type="button"
                    onClick={() => toggleGroup(acts)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink/60 hover:bg-parchment dark:text-parchment/60 dark:hover:bg-white/5"
                  >
                    {g.group}
                    <span className="normal-case tracking-normal text-growth-700 dark:text-growth-500">{all ? "None" : "All"}</span>
                  </button>
                </legend>
                {g.actions.map((a) => (
                  <label key={a.action} className="flex min-h-[36px] cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-ink hover:bg-parchment dark:text-parchment dark:hover:bg-white/5 max-md:min-h-[44px]">
                    <input type="checkbox" checked={value.includes(a.action)} onChange={() => toggle(a.action)} className="h-4 w-4 accent-[#15884A]" />
                    {a.label}
                  </label>
                ))}
              </fieldset>
            );
          })}
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className={`${btnGhost} mt-1 w-full`}>
              Show all actions
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function UserPicker({ id, name, onChange }: { id: string; name: string; onChange: (id: string | null, name: string | null) => void }) {
  const { open, setOpen, root } = usePopover();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);
  const results = useQuery({
    queryKey: ["admin", "userPicker", debounced],
    queryFn: () => adminApi.users({ search: debounced, sort: "name", limit: 8, offset: 0 }),
    enabled: open,
  });

  if (id) {
    return (
      <div className="flex h-10 items-center gap-1 rounded-lg border border-growth-500/40 bg-growth-50 pl-3 pr-1 text-sm text-growth-700 max-md:h-12 lg:max-w-[240px]">
        <span className="min-w-0 flex-1 truncate font-medium">{name || "One user"}</span>
        <button type="button" aria-label="Show all users" onClick={() => onChange(null, null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-black/5">
          <CloseIcon size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={root} className="relative lg:w-48">
      <button type="button" className={triggerClass} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="truncate text-ink/65 dark:text-parchment/65">All users</span>
        <ChevronDownIcon size={14} />
      </button>
      {open && (
        <div className={panelClass}>
          <input
            autoFocus
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search users"
            className={inputClass}
          />
          <ul role="listbox" aria-label="Users" className="mt-1 max-h-64 overflow-y-auto">
            {results.isPending ? (
              <li className="px-2 py-3 text-sm text-ink/60 dark:text-parchment/60">Searching…</li>
            ) : (results.data?.rows ?? []).length === 0 ? (
              <li className="px-2 py-3 text-sm text-ink/60 dark:text-parchment/60">No users found.</li>
            ) : (
              results.data!.rows.map((u) => (
                <li key={u.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(u.id, u.name);
                      setOpen(false);
                      setText("");
                    }}
                    className="w-full rounded-md px-2 py-2 text-left hover:bg-parchment focus-visible:bg-parchment focus-visible:outline-none dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
                  >
                    <span className="block truncate text-sm font-medium text-ink dark:text-parchment">{u.name}</span>
                    <span className="block truncate text-xs text-ink/60 dark:text-parchment/60">{u.email}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
