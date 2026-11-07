import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { AuditEvent } from "./api";
import { EventIcon, EventSentence, actionInfo, actorLabel, describeText } from "./events";
import { clockTime, dayHeading, dayKey, exactTime, fullDate, hectares, relativeTime } from "./format";
import Modal from "../components/Modal";
import { Badge, CopyButton, KeyValue } from "./ui";
import { ChevronRightIcon } from "../components/icons";

/**
 * Audit events as sentences, newest first, under day headings. Names in a
 * sentence link to that user or field. The time on the right opens the
 * full record; clicking anywhere else on the row does the same.
 */
export function EventList({ events, showRelative = false, compact = false }: { events: AuditEvent[]; showRelative?: boolean; compact?: boolean }) {
  const pad = compact ? "px-4" : "px-4 md:px-6 tall:px-4";
  const [open, setOpen] = useState<AuditEvent | null>(null);
  const groups: { key: string; heading: string; items: AuditEvent[] }[] = [];
  for (const e of events) {
    const key = dayKey(e.occurred_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(e);
    else groups.push({ key, heading: dayHeading(e.occurred_at), items: [e] });
  }

  return (
    <>
      <div>
        {groups.map((g) => (
          <Fragment key={g.key}>
            <h3 className={`sticky top-0 z-[1] bg-white/95 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-ink/55 backdrop-blur-sm dark:bg-night-900/95 dark:text-parchment/55 ${pad}`}>
              {g.heading}
            </h3>
            <ol className="pb-2">
              {g.items.map((e) => (
                <li
                  key={e.id}
                  onClick={(ev) => {
                    // Clicks on a name link go to that page instead.
                    if ((ev.target as HTMLElement).closest("a,button")) return;
                    setOpen(e);
                  }}
                  className={`flex cursor-pointer items-start ${compact ? "gap-2" : "gap-3"} py-2 transition-colors hover:bg-parchment/70 dark:hover:bg-white/[0.03] ${pad}`}
                >
                  <EventIcon action={e.action} size={compact ? 28 : 32} />
                  <p className="min-w-0 flex-1 py-1.5 text-sm leading-5 text-ink/80 dark:text-parchment/80">
                    <EventSentence event={e} />
                    {e.details?.backfilled && <span className="ml-2 align-middle"><Badge>Reconstructed</Badge></span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpen(e)}
                    title={exactTime(e.occurred_at, true)}
                    aria-label={`Details: ${describeText(e)}, ${exactTime(e.occurred_at)}`}
                    className="flex h-8 shrink-0 items-center gap-1 rounded-md pl-2 pr-1 text-xs tabular-nums text-ink/60 transition-colors hover:bg-parchment hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500 dark:text-parchment/60 dark:hover:bg-white/10 dark:hover:text-parchment max-md:h-10"
                  >
                    <time dateTime={e.occurred_at}>{showRelative ? relativeTime(e.occurred_at) : clockTime(e.occurred_at)}</time>
                    {!compact && <ChevronRightIcon size={14} />}
                  </button>
                </li>
              ))}
            </ol>
          </Fragment>
        ))}
      </div>
      <EventDetail event={open} onClose={() => setOpen(null)} />
    </>
  );
}

const SOURCE_WORDS: Record<string, string> = {
  database: "Database (recorded automatically)",
  app: "App",
  system: "Daily satellite job",
};

const KEY_WORDS: Record<string, string> = {
  crop: "Crop",
  area_ha: "Area",
  planting_date: "Planting date",
  owner_id: "Owner ID",
  name: "Name",
  boundary: "Boundary",
  phone: "Phone",
  location: "Location",
  photo: "Photo",
  is_active: "Account active",
  method: "Method",
  reason: "Reason",
  field_count: "Fields at the time",
  from: "From",
  to: "To",
  field_id: "Field ID",
  field_name: "Field",
  accurate: "Farmer agreed",
  suggested_cause: "Cause Growell suggested",
  answer: "Farmer's answer",
  fields_checked: "Fields checked",
  new_images: "New images",
  failures: "Failures",
  alerts_created: "Alerts created",
  notifications_sent: "Notifications sent",
  farmers: "Farmers",
  duration_ms: "Took",
  backfilled: "Reconstructed",
};

function show(key: string, v: unknown): ReactNode {
  if (v === null || v === undefined || v === "") return <span className="text-ink/55 dark:text-parchment/55">None</span>;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (key === "area_ha") return hectares(Number(v));
  if (key === "duration_ms") return `${Math.round(Number(v) / 100) / 10} s`;
  if (key === "reason") return { button: "Tapped Log out", idle: "Idle too long", deactivated: "Deactivated account" }[String(v)] ?? String(v);
  if (typeof v === "object") return <code className="text-xs">{JSON.stringify(v)}</code>;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return fullDate(v);
  if (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(v)) return <code className="break-all text-xs">{v}</code>;
  return String(v);
}

/**
 * Shows only the events that fit whole in the space it is given, so the
 * list never needs a scrollbar. Tells the parent how many fit, so paging
 * can start the next page right after the last one shown.
 */
export function FitEventList({
  events,
  compact = false,
  onFit,
  className = "",
}: {
  events: AuditEvent[];
  compact?: boolean;
  onFit?: (n: number) => void;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  const [height, setHeight] = useState(0);
  const onFitRef = useRef(onFit);
  onFitRef.current = onFit;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // New size or new events: show them all again, then measure.
  useLayoutEffect(() => setFit(null), [height, events]);
  useLayoutEffect(() => {
    if (fit !== null || !box.current) return;
    const bottom = box.current.getBoundingClientRect().bottom;
    let n = 0;
    for (const li of box.current.querySelectorAll("ol > li")) {
      if (li.getBoundingClientRect().bottom <= bottom + 0.5) n++;
      else break;
    }
    const shown = Math.max(1, Math.min(n, events.length));
    setFit(shown);
    onFitRef.current?.(shown);
  });

  return (
    <div ref={box} className={`min-h-0 flex-1 overflow-hidden ${className}`}>
      <EventList events={fit === null ? events : events.slice(0, fit)} compact={compact} />
    </div>
  );
}

export function EventDetail({ event, onClose }: { event: AuditEvent | null; onClose: () => void }) {
  const e = event;
  const details = e?.details ?? {};
  const changes: Record<string, any> | null = details.changes ?? null;
  const rest = Object.entries(details).filter(([k]) => k !== "changes");

  return (
    <Modal open={!!e} onClose={onClose} title={e ? actionInfo(e.action).label : ""} description={e ? describeText(e) : undefined} size="md">
      {e && (
        <div className="space-y-6 pb-4">
          <KeyValue
            items={[
              ["When", exactTime(e.occurred_at, true)],
              [
                "Who",
                e.actor_id ? (
                  <span>
                    {actorLabel(e)}
                    {e.actor_email && e.actor_name && <span className="block text-xs font-normal text-ink/60 dark:text-parchment/60">{e.actor_email}</span>}
                  </span>
                ) : (
                  actorLabel(e)
                ),
              ],
              [
                e.entity_type ? `${e.entity_type[0].toUpperCase()}${e.entity_type.slice(1)} ID` : "Item ID",
                e.entity_id ? (
                  <span className="inline-flex items-center gap-1">
                    <code className="break-all text-xs">{e.entity_id}</code>
                    <CopyButton text={e.entity_id} label="Copy ID" />
                  </span>
                ) : (
                  "None"
                ),
              ],
              ["Recorded by", SOURCE_WORDS[e.source] ?? e.source],
              ["Event number", `#${e.id}`],
            ]}
          />

          {changes && Object.keys(changes).length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink dark:text-parchment">What changed</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink/60 dark:text-parchment/60">
                    <th scope="col" className="py-2 pr-2 font-semibold">Item</th>
                    <th scope="col" className="py-2 pr-2 font-semibold">From</th>
                    <th scope="col" className="py-2 font-semibold">To</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(changes).map(([k, v]) => {
                    const pair = v && typeof v === "object" && ("from" in v || "to" in v);
                    return (
                      <tr key={k} className="border-t border-canopy-900/5 dark:border-white/5">
                        <th scope="row" className="py-2 pr-2 text-left font-medium text-ink/70 dark:text-parchment/70">{KEY_WORDS[k] ?? k}</th>
                        {pair ? (
                          <>
                            <td className="py-2 pr-2 text-ink dark:text-parchment">{show(k, v.from)}</td>
                            <td className="py-2 font-medium text-ink dark:text-parchment">{show(k, v.to)}</td>
                          </>
                        ) : (
                          <td colSpan={2} className="py-2 text-ink dark:text-parchment">
                            {String(v) === "changed" ? "Changed (values not stored)" : String(v) === "redrawn" ? "Redrawn" : show(k, v)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {rest.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-ink dark:text-parchment">Details</h3>
              <KeyValue items={rest.map(([k, v]) => [KEY_WORDS[k] ?? k, show(k, v)] as [string, ReactNode])} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
