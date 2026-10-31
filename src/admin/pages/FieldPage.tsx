import { useMemo, type ReactNode } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { adminApi, AdminError } from "../api";
import { OutlineMap } from "../maps";
import { EventList } from "../EventList";
import { exactTime, fullDate, hectares } from "../format";
import { Badge, CopyButton, EmptyState, ErrorState, Health, LoadMore, PageHeader, ScrollCard, card } from "../ui";
import NdviChart from "../../components/NdviChart";
import { Skeleton, LoadingRegion } from "../../components/Skeleton";

const CAUSE_WORDS: Record<string, string> = {
  drought: "Drought stress",
  excess_rainfall: "Too much water",
  pest_disease: "Pest or disease",
  natural_senescence: "Natural ripening",
};

const STATUS_WORDS: Record<string, { label: string; tone: "warn" | "create" | "neutral" }> = {
  open: { label: "Waiting for answer", tone: "warn" },
  reviewed: { label: "Farmer agreed", tone: "create" },
  dismissed: { label: "Farmer disagreed", tone: "neutral" },
};

export default function FieldPage() {
  const { fieldId = "" } = useParams();
  const q = useQuery({ queryKey: ["admin", "field", fieldId], queryFn: () => adminApi.field(fieldId) });
  const activity = useInfiniteQuery({
    queryKey: ["admin", "audit", "field", fieldId],
    queryFn: ({ pageParam }) => adminApi.audit({ entityId: fieldId }, pageParam, 30),
    initialPageParam: null as { time: string; id: number } | null,
    getNextPageParam: (last) => {
      if (!last.has_more || last.rows.length === 0) return undefined;
      const r = last.rows[last.rows.length - 1];
      return { time: r.occurred_at, id: r.id };
    },
  });
  const events = useMemo(() => activity.data?.pages.flatMap((p) => p.rows) ?? [], [activity.data]);

  if (q.error instanceof AdminError && q.error.forbidden) return <Navigate to="/" replace />;
  const f = q.data;
  const latest = f && f.ndvi.length > 0 ? Number(f.ndvi[f.ndvi.length - 1].ndvi_value) : null;
  const range = f && f.ndvi.length > 0 ? { start: f.ndvi[0].capture_date, end: f.ndvi[f.ndvi.length - 1].capture_date } : null;

  const details: [string, ReactNode][] = f
    ? [
        [
          "Field ID",
          <span className="inline-flex items-center gap-1">
            <code className="text-xs">{f.id.slice(0, 8)}…</code>
            <CopyButton text={f.id} label="Copy field ID" />
          </span>,
        ],
        ["Owner", <span title={f.owner_email ?? undefined}>{f.owner_name}</span>],
        ["Crop", f.crop ?? "Other"],
        ["Area", hectares(f.area_ha)],
        ["Planting date", f.planting_date ? fullDate(f.planting_date) : "Not set"],
        ["Crop health", <Health ndvi={latest} />],
        ["Satellite readings", f.ndvi.length],
        ["Added", <span title={exactTime(f.created_at)}>{fullDate(f.created_at)}</span>],
        ...(f.deleted_at ? ([["Deleted", <span title={exactTime(f.deleted_at)}>{fullDate(f.deleted_at)}</span>]] as [string, ReactNode][]) : []),
      ]
    : [];

  return (
    <div className="flex flex-col tall:h-full tall:min-h-0">
      {q.isError ? (
        <>
          <PageHeader title="Field" back={{ to: "/admin/fields", label: "Fields" }} />
          <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
        </>
      ) : !f ? (
        <LoadingRegion label="Loading field">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-3 h-8 w-64" />
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
            <Skeleton className="h-[360px] w-full" />
            <Skeleton className="h-[360px] w-full" />
          </div>
        </LoadingRegion>
      ) : (
        <>
          <PageHeader
            back={{ to: "/admin/fields", label: "Fields" }}
            title={f.name}
            description={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Owned by{" "}
                  <Link to={`/admin/users/${f.owner_id}`} className="rounded font-medium text-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500 dark:text-parchment">
                    {f.owner_name}
                  </Link>
                </span>
                {f.deleted_at && <Badge tone="delete">Deleted {fullDate(f.deleted_at)}</Badge>}
                <span className="text-xs text-ink/50 dark:text-parchment/50">Read only</span>
              </span>
            }
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 tall:min-h-0 tall:grow tall:basis-0">
            {/* Left: the map fills what the details leave. */}
            <div className="flex flex-col gap-4 tall:min-h-0">
              <div className="h-[300px] md:h-[360px] tall:h-0 tall:min-h-[240px] tall:grow tall:basis-0">
                <OutlineMap boundary={f.boundary} ndvi={latest} deleted={!!f.deleted_at} />
              </div>
              <section className={`${card} shrink-0 p-4`} aria-labelledby="info-title">
                <h2 id="info-title" className="mb-3 text-base font-semibold text-ink dark:text-parchment">Details</h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {details.map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-xs text-ink/60 dark:text-parchment/60">{k}</dt>
                      <dd className="truncate font-medium text-ink dark:text-parchment">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>

            {/* Right: the chart fills what the two lists leave. */}
            <div className="flex flex-col gap-4 tall:min-h-0">
              <div className="h-[340px] tall:h-0 tall:min-h-[220px] tall:grow tall:basis-0">
                {range ? (
                  <NdviChart data={f.ndvi} anomalyDates={f.alerts.map((a) => a.date_detected)} areaHectares={f.area_ha} range={range} />
                ) : (
                  <section className={`${card} flex h-full flex-col p-4`}>
                    <h2 className="text-sm font-medium text-ink/70 dark:text-parchment/70">Crop health</h2>
                    <EmptyState title="No satellite readings for this field yet." />
                  </section>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_3fr] tall:h-[240px] tall:shrink-0">
                <ScrollCard title="Alerts">
                  {f.alerts.length === 0 ? (
                    <EmptyState title="No alerts for this field." />
                  ) : (
                    <ul className="divide-y divide-canopy-900/5 pb-2 dark:divide-white/5">
                      {f.alerts.map((a) => (
                        <li key={a.id} className="px-4 py-2">
                          <p className="truncate text-sm font-semibold text-ink dark:text-parchment">
                            {CAUSE_WORDS[a.cause ?? ""] ?? "Unknown cause"}, {Math.round(Number(a.drop_pct))}% drop
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/60 dark:text-parchment/60">
                            <Badge tone={STATUS_WORDS[a.status]?.tone ?? "neutral"}>{STATUS_WORDS[a.status]?.label ?? a.status}</Badge>
                            {fullDate(a.date_detected)}, {a.severity}
                          </p>
                          {a.status === "dismissed" && a.answer && (
                            <p className="mt-1 truncate text-sm text-ink/80 dark:text-parchment/80" title={a.answer}>
                              Farmer said: "{a.answer}"
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollCard>

                <ScrollCard title="Activity">
                  {activity.isError ? (
                    <p className="px-4 py-6 text-sm text-ink/70 dark:text-parchment/70">Couldn't load activity.</p>
                  ) : activity.isPending ? (
                    <div className="space-y-3 p-4">
                      {Array.from({ length: 3 }, (_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : events.length === 0 ? (
                    <EmptyState title="Nothing recorded yet." />
                  ) : (
                    <>
                      <EventList events={events} compact />
                      {activity.hasNextPage && <LoadMore hasMore loading={activity.isFetchingNextPage} onLoad={() => activity.fetchNextPage()} />}
                    </>
                  )}
                </ScrollCard>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
