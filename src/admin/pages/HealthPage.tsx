import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { adminApi, type Health } from "../api";
import { CountChart } from "../charts";
import { durationText, exactTime, fullDate, relativeTime, shortDate } from "../format";
import { Badge, EmptyState, ErrorState, PageHeader, ScrollCard, card, num, td, th } from "../ui";
import { Skeleton, LoadingRegion } from "../../components/Skeleton";
import { CheckIcon, WarningIcon } from "../../components/icons";

/**
 * Is the daily check running and finding images? On a computer with room
 * it fits one screen: one status strip, the runs on the left, and the
 * failures chart over the fields without new images on the right.
 */
export default function HealthPage() {
  const q = useQuery({ queryKey: ["admin", "health"], queryFn: adminApi.health });
  const h = q.data;

  return (
    <div className="flex flex-col tall:h-full tall:min-h-0">
      <PageHeader title="System health" description="Whether the daily satellite and weather check is running and finding images." />
      {q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : !h ? (
        <LoadingRegion label="Loading system health" className="flex flex-col gap-4 tall:min-h-0 tall:grow">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr] tall:grow">
            <Skeleton className="h-72 w-full tall:h-full" />
            <Skeleton className="h-72 w-full tall:h-full" />
          </div>
        </LoadingRegion>
      ) : (
        <>
          <StatusStrip h={h} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr] tall:min-h-0 tall:grow tall:basis-0 tall:grid-rows-[minmax(160px,1fr)_minmax(160px,1fr)]">
            <ScrollCard title="Recent runs" className="lg:row-span-2">
              {h.runs.length === 0 ? (
                <EmptyState title="No runs recorded yet. Each run of the daily check appears here." />
              ) : (
                <div className="overflow-x-auto tall:overflow-visible">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr>
                      <th scope="col" className={th}>When</th>
                      <th scope="col" className={`${th} ${num}`}>Took</th>
                      <th scope="col" className={`${th} ${num}`}>Fields</th>
                      <th scope="col" className={`${th} ${num}`}>New images</th>
                      <th scope="col" className={`${th} ${num}`}>Failures</th>
                      <th scope="col" className={th}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h.runs.map((r) => {
                      const f = r.details.failures ?? 0;
                      return (
                        <tr key={r.id} className="h-12 border-t border-canopy-900/5 dark:border-white/5 tall:h-10">
                          <td className={`${td} tall:py-2`}>
                            <time dateTime={r.at} title={exactTime(r.at)}>{relativeTime(r.at)}</time>
                          </td>
                          <td className={`${td} ${num} tall:py-2`}>{durationText(r.details.duration_ms)}</td>
                          <td className={`${td} ${num} tall:py-2`}>{r.details.fields_checked ?? 0}</td>
                          <td className={`${td} ${num} tall:py-2`}>{r.details.new_images ?? 0}</td>
                          <td className={`${td} ${num} tall:py-2`}>{f}</td>
                          <td className={`${td} tall:py-2`}>{f === 0 ? <Badge tone="create">OK</Badge> : <Badge tone="warn">{f} failed</Badge>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </ScrollCard>

            <div className="tall:min-h-0">
              <CountChart
                fill
                title="Failed checks per day"
                kind="bar"
                tone="alert"
                data={h.failures_per_day.map((d) => ({ key: d.day, count: d.count }))}
                unit={(n) => `failed check${n === 1 ? "" : "s"}`}
                tooltipTitle={(k) => shortDate(k, true)}
                summary={`${h.failures_per_day.reduce((s, d) => s + d.count, 0)} failed field checks in the last 14 days.`}
              />
            </div>

            <ScrollCard title="Fields without a new image for 10+ days">
              {h.stale_fields.length === 0 ? (
                <EmptyState title="Every field has a recent image." />
              ) : (
                <ul className="divide-y divide-canopy-900/5 pb-2 dark:divide-white/5">
                  {h.stale_fields.map((f) => (
                    <li key={f.id}>
                      <Link
                        to={`/admin/fields/${f.id}`}
                        className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-parchment/70 focus-visible:bg-parchment focus-visible:outline-none dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/5 md:px-6 tall:px-4"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink dark:text-parchment">{f.name}</span>
                          <span className="block truncate text-xs text-ink/60 dark:text-parchment/60">{f.owner_name}</span>
                        </span>
                        <span className="min-w-0 max-w-[55%] text-right">
                          <span className="block text-sm tabular-nums text-ink dark:text-parchment">
                            {f.days_since === null ? "No image yet" : `${f.days_since} days`}
                          </span>
                          <span className="block truncate text-xs text-ink/60 dark:text-parchment/60" title={f.last_failure ?? undefined}>
                            {f.last_failure ?? "No failure recorded"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollCard>
          </div>
        </>
      )}
    </div>
  );
}

function StatusStrip({ h }: { h: Health }) {
  const last = h.runs[0];
  const hours = last ? (Date.now() - new Date(last.at).getTime()) / 3_600_000 : Infinity;
  const failures14 = h.failures_per_day.reduce((s, d) => s + d.count, 0);
  const failuresRecent = h.failures_per_day.slice(-3).reduce((s, d) => s + d.count, 0);

  let ok = true;
  let reason: string;
  if (!last) {
    ok = false;
    reason = "No run of the daily check has been recorded yet.";
  } else if (hours > 36) {
    ok = false;
    reason = `The daily check last ran ${relativeTime(last.at).toLowerCase()} (${fullDate(last.at)}). It should run every day.`;
  } else if ((last.details.failures ?? 0) > 0) {
    ok = false;
    reason = `The last run had ${last.details.failures} failed field check${last.details.failures === 1 ? "" : "s"}.`;
  } else {
    reason = `The last run checked every field with no failures${failuresRecent > 0 ? `, but ${failuresRecent} failed in the last 3 days` : ""}.`;
  }

  const figures: [string, string][] = [
    ["Last run", last ? relativeTime(last.at) : "Never"],
    ["Fields checked", last ? String(last.details.fields_checked ?? 0) : "None"],
    ["Failures, 14 days", String(failures14)],
    ["Without new image", String(h.stale_fields.length)],
  ];

  return (
    <section role="status" className={`${card} mb-4 flex shrink-0 flex-col gap-4 p-4 md:flex-row md:items-center`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ok ? "bg-growth-600 text-white" : "bg-laterite-700 text-white"}`} aria-hidden>
          {ok ? <CheckIcon size={18} /> : <WarningIcon size={18} />}
        </span>
        <div className="min-w-0">
          <h2 className={`text-base font-semibold ${ok ? "text-growth-700" : "text-laterite-700"}`}>{ok ? "Healthy" : "Needs attention"}</h2>
          <p className="text-sm text-ink/70 dark:text-parchment/70 tall:truncate" title={reason}>
            {reason}
          </p>
        </div>
      </div>
      <dl className="grid shrink-0 grid-cols-2 gap-y-3 sm:grid-cols-4 md:flex md:divide-x md:divide-canopy-900/10 md:dark:divide-white/10">
        {figures.map(([label, value]) => (
          <div key={label} className="md:px-4 md:last:pr-0">
            <dt className="text-xs text-ink/60 dark:text-parchment/60">{label}</dt>
            <dd className="whitespace-nowrap text-base font-semibold tabular-nums text-ink dark:text-parchment">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
