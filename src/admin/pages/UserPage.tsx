import { useMemo, useState, type ReactNode } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { adminApi, AdminError, type AuditEvent } from "../api";
import { EventList } from "../EventList";
import { actionInfo, describeText } from "../events";
import { downloadCsv, exactTime, fullDate, hectares, todayStamp } from "../format";
import { Badge, EmptyState, ErrorState, Health, LoadMore, PageHeader, ScrollCard, StatCompact, When, btnSecondary, card } from "../ui";
import { Skeleton, LoadingRegion } from "../../components/Skeleton";
import Avatar from "../../components/Avatar";
import { BusyLabel } from "../../components/Busy";
import { ActivityIcon, BellIcon, DownloadIcon, LeafIcon, MapIcon } from "../../components/icons";

export default function UserPage() {
  const { userId = "" } = useParams();
  const q = useQuery({ queryKey: ["admin", "user", userId], queryFn: () => adminApi.user(userId) });
  const activity = useInfiniteQuery({
    queryKey: ["admin", "audit", "user", userId],
    queryFn: ({ pageParam }) => adminApi.audit({ actor: userId }, pageParam, 30),
    initialPageParam: null as { time: string; id: number } | null,
    getNextPageParam: (last) => {
      if (!last.has_more || last.rows.length === 0) return undefined;
      const r = last.rows[last.rows.length - 1];
      return { time: r.occurred_at, id: r.id };
    },
  });
  const events = useMemo(() => activity.data?.pages.flatMap((p) => p.rows) ?? [], [activity.data]);
  const [exporting, setExporting] = useState(false);

  if (q.error instanceof AdminError && q.error.forbidden) return <Navigate to="/" replace />;
  const u = q.data;
  const liveFields = u ? u.fields.filter((f) => !f.deleted_at) : [];

  async function exportActivity() {
    if (!u) return;
    setExporting(true);
    try {
      const { rows } = await adminApi.audit({ actor: userId }, null, 10000);
      downloadCsv(`growell-activity-${slug(u.name)}-${todayStamp()}.csv`, ["Time (UTC)", "Local time", "Action", "What happened", "Item ID", "Details"], rows.map(csvRow));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col tall:h-full tall:min-h-0">
      {q.isError ? (
        <>
          <PageHeader title="User" back={{ to: "/admin/users", label: "Users" }} />
          {q.error instanceof AdminError && q.error.notFound ? (
            <div className={card}>
              <EmptyState
                title="This account no longer exists. Its history is still in Activity."
                action={<Link className={btnSecondary} to={`/admin/activity?user=${userId}`}>View its activity</Link>}
              />
            </div>
          ) : (
            <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
          )}
        </>
      ) : !u ? (
        <LoadingRegion label="Loading user">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-3 h-8 w-64" />
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="mt-6 h-64 w-full" />
        </LoadingRegion>
      ) : (
        <>
          <PageHeader
            back={{ to: "/admin/users", label: "Users" }}
            title={u.name}
            description={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 tall:flex-nowrap">
                <span className="truncate">{u.email}</span>
                <span aria-hidden>·</span>
                <span className="whitespace-nowrap">Joined {fullDate(u.joined)}</span>
                <span aria-hidden>·</span>
                <span className="whitespace-nowrap">
                  Last active: <When iso={u.last_active} />
                </span>
                {!u.is_active && <Badge>Deactivated</Badge>}
              </span>
            }
            actions={
              <button type="button" className={btnSecondary} onClick={exportActivity} disabled={exporting}>
                <DownloadIcon />
                <BusyLabel busy={exporting} label="Export activity" busyLabel="Exporting…" />
              </button>
            }
          />

          <div className="mb-4 grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCompact label="Fields" value={liveFields.length} sub={deletedText(u.fields.length - liveFields.length)} icon={<MapIcon size={18} />} />
            <StatCompact label="Area" value={hectares(liveFields.reduce((s, f) => s + Number(f.area_ha ?? 0), 0))} icon={<LeafIcon size={18} />} />
            <StatCompact label="Open alerts" value={u.open_alerts} icon={<BellIcon size={18} />} />
            <StatCompact label="Actions" value={u.total_actions.toLocaleString("en-GB")} sub="Since recording started" icon={<ActivityIcon size={18} />} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,2fr)_3fr] tall:min-h-0 tall:grow tall:basis-0 tall:grid-rows-[auto_minmax(160px,1fr)]">
            <section className={`${card} p-4`} aria-labelledby="profile-title">
              <div className="mb-3 flex items-center gap-3">
                <Avatar avatarUrl={u.avatar_url} name={u.name} size={40} />
                <h2 id="profile-title" className="text-base font-semibold text-ink dark:text-parchment">Profile</h2>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {(
                  [
                    ["Phone", u.phone || "Not given"],
                    ["Location", u.location || "Not given"],
                    ["Last sign-in", u.last_sign_in_at ? <span title={exactTime(u.last_sign_in_at)}><When iso={u.last_sign_in_at} /></span> : "Never"],
                    ["Account", u.is_active ? "Active" : "Deactivated"],
                  ] as [string, ReactNode][]
                ).map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-xs text-ink/60 dark:text-parchment/60">{k}</dt>
                    <dd className="truncate font-medium text-ink dark:text-parchment">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <ScrollCard title="Fields" className="lg:col-start-1 lg:row-start-2">
              {u.fields.length === 0 ? (
                <EmptyState title="This user hasn't added a field yet." />
              ) : (
                <ul className="divide-y divide-canopy-900/5 pb-2 dark:divide-white/5">
                  {u.fields.map((f) => (
                    <li key={f.id} className={f.deleted_at ? "opacity-60" : ""}>
                      <Link
                        to={`/admin/fields/${f.id}`}
                        className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-parchment/70 focus-visible:bg-parchment focus-visible:outline-none dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium text-ink dark:text-parchment">
                            <span className="truncate">{f.name}</span>
                            {f.deleted_at && <Badge tone="delete">Deleted {fullDate(f.deleted_at)}</Badge>}
                          </span>
                          <span className="block truncate text-xs text-ink/60 dark:text-parchment/60">
                            {f.crop ?? "Other"}, {hectares(f.area_ha)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm text-ink dark:text-parchment">
                          <Health ndvi={f.latest_ndvi} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollCard>

            <ScrollCard title="Activity" className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              {activity.isError ? (
                <div className="p-4">
                  <ErrorState message={(activity.error as Error).message} onRetry={() => activity.refetch()} />
                </div>
              ) : activity.isPending ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <EmptyState title="Nothing recorded for this user yet." />
              ) : (
                <>
                  <EventList events={events} compact />
                  {activity.hasNextPage && (
                    <LoadMore hasMore loading={activity.isFetchingNextPage} onLoad={() => activity.fetchNextPage()} />
                  )}
                </>
              )}
            </ScrollCard>
          </div>
        </>
      )}
    </div>
  );
}

function deletedText(n: number) {
  return n > 0 ? `${n} deleted` : undefined;
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "user";
}

export function csvRow(e: AuditEvent) {
  return [
    e.occurred_at,
    new Date(e.occurred_at).toLocaleString("en-GB"),
    actionInfo(e.action).label,
    describeText(e),
    e.entity_id,
    JSON.stringify(e.details ?? {}),
  ];
}
