import { useQuery } from "@tanstack/react-query";
import { useIsPhone } from "../../hooks/useIsPhone";
import { Link } from "react-router-dom";
import { adminApi, type AuditEvent, type Overview } from "../api";
import { CountChart } from "../charts";
import { FitEventList } from "../EventList";
import { count, exactTime, hectares, relativeTime, shortDate } from "../format";
import { ErrorState, InfoTip, PageHeader, StatCompact, card } from "../ui";
import { Skeleton, LoadingRegion } from "../../components/Skeleton";
import { BellIcon, MapIcon, UsersIcon, ActivityIcon, WarningIcon } from "../../components/icons";

const MAX_CROPS = 6;

/**
 * Everything at a glance. On a computer with room it fits one screen:
 * a slim row of numbers, two charts that fill the space left, crops under
 * them, and the latest activity in a column that scrolls by itself.
 */
export default function OverviewPage() {
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: adminApi.overview });
  const latest = useQuery({ queryKey: ["admin", "audit", "latest"], queryFn: () => adminApi.audit({}, null, 20) });
  const o = overview.data;
  // Phones scroll the page, so a shorter list there.
  const isPhone = useIsPhone();

  return (
    <div className="flex flex-col tall:h-full tall:min-h-0">
      <PageHeader title="Overview" description="How Growell is being used, at a glance." actions={o ? <PipelinePill run={o.last_run} /> : undefined} />

      {overview.isError ? (
        <ErrorState message={(overview.error as Error).message} onRetry={() => overview.refetch()} />
      ) : !o ? (
        <OverviewSkeleton />
      ) : (
        <>
          <div className="mb-4 grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCompact
              label="Users"
              value={count(o.total_users)}
              sub={o.new_users_7d > 0 ? `+${o.new_users_7d} this week` : "None new this week"}
              to="/admin/users"
              icon={<UsersIcon size={18} />}
            />
            <StatCompact
              label="Active this week"
              value={count(o.active_users_7d)}
              sub={o.total_users > 0 ? `${Math.round((o.active_users_7d / o.total_users) * 100)}% of users` : undefined}
              to="/admin/users?sort=last_active"
              icon={<ActivityIcon size={18} />}
            />
            <StatCompact label="Fields" value={count(o.live_fields)} sub={`${hectares(o.total_ha)} in total`} to="/admin/fields" icon={<MapIcon size={18} />} />
            <StatCompact label="Open alerts" value={count(o.open_alerts)} sub="Waiting for an answer" to="/admin/fields?status=alerts" icon={<BellIcon size={18} />} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 tall:min-h-0 tall:grow tall:basis-0 tall:grid-cols-[1fr_1fr_minmax(320px,0.9fr)] tall:grid-rows-[minmax(200px,1fr)_auto]">
            <div className="tall:col-start-1 tall:row-start-1 tall:min-h-0">
              <CountChart
                fill
                title="New users per week"
                kind="bar"
                data={o.signups_per_week.map((w) => ({ key: w.week, count: w.count }))}
                unit={(n) => `new user${n === 1 ? "" : "s"}`}
                tooltipTitle={(k) => `Week of ${shortDate(k)}`}
                summary={`${o.signups_per_week.reduce((s, w) => s + w.count, 0)} people signed up in the last 12 weeks.`}
              />
            </div>
            <div className="tall:col-start-2 tall:row-start-1 tall:min-h-0">
              <CountChart
                fill
                title="Actions by users per day"
                kind="line"
                data={o.actions_per_day.map((d) => ({ key: d.day, count: d.count }))}
                unit={(n) => `action${n === 1 ? "" : "s"}`}
                tooltipTitle={(k) => shortDate(k, true)}
                summary={`${o.actions_per_day.reduce((s, d) => s + d.count, 0)} actions by users in the last 30 days, such as logging in or adding a field.`}
              />
            </div>
            <div className="tall:col-start-1 tall:row-start-2">
              <CropList crops={o.fields_by_crop} />
            </div>
            <div className="tall:col-start-2 tall:row-start-2">
              <AccuracyCard />
            </div>
            <section
              aria-labelledby="latest-title"
              className={`${card} flex min-h-0 flex-col overflow-hidden lg:col-span-2 tall:col-span-1 tall:col-start-3 tall:row-span-2 tall:row-start-1`}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-4">
                <h2 id="latest-title" className="text-base font-semibold text-ink dark:text-parchment">
                  Latest activity
                </h2>
                <Link to="/admin/activity" className="rounded text-sm font-medium text-growth-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500 dark:text-growth-500">
                  View all
                </Link>
              </div>
              {latest.isError ? (
                <p className="px-4 py-8 text-sm text-ink/70 dark:text-parchment/70">Couldn't load the latest activity.</p>
              ) : !latest.data ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : latest.data.rows.length === 0 ? (
                <p className="px-4 py-8 text-sm text-ink/70 dark:text-parchment/70">Nothing has happened yet.</p>
              ) : (
                <FitEventList events={latest.data.rows.slice(0, isPhone ? 8 : 20)} compact className="pb-2" />
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

const CAUSE_WORDS: Record<string, string> = {
  drought: "Drought stress",
  excess_rainfall: "Too much water",
  pest_disease: "Pest or disease",
  natural_senescence: "Natural ripening",
  unknown: "Unknown cause",
};
// Short names for the narrow card; the full name is in each row's tooltip.
const CAUSE_SHORT: Record<string, string> = {
  drought: "Drought",
  excess_rainfall: "Too wet",
  pest_disease: "Pests",
  natural_senescence: "Ripening",
  unknown: "Unknown",
};

/**
 * How often farmers said an alert was right. This is the measured result of
 * the alert system: each farmer's yes or no answer is the ground truth.
 */
function AccuracyCard() {
  const q = useQuery({ queryKey: ["admin", "accuracy"], queryFn: adminApi.alertAccuracy });
  const a = q.data;
  const pct = (c: number, n: number) => (n > 0 ? Math.round((c / n) * 100) : 0);

  return (
    <section className={`${card} h-full p-4 md:p-6 tall:p-4`} aria-labelledby="accuracy-title">
      <div className="flex items-center gap-1">
        <h2 id="accuracy-title" className="text-base font-semibold text-ink dark:text-parchment">
          Alert accuracy
        </h2>
        <InfoTip
          label="About alert accuracy"
          text="Each alert asks the farmer whether it was right. This is the share of answered alerts the farmer agreed with. Unanswered alerts are not counted."
        />
      </div>
      {q.isError ? (
        <p className="mt-3 text-sm text-ink/70 dark:text-parchment/70">Couldn't load alert accuracy.</p>
      ) : !a ? (
        <Skeleton className="mt-3 h-20 w-full" />
      ) : a.answered === 0 ? (
        <p className="mt-3 text-sm text-ink/70 dark:text-parchment/70">
          No answers yet. This shows once farmers answer their alerts{a.alerts > 0 ? ` (${a.alerts} sent so far)` : ""}.
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr] sm:items-center">
          <div>
            <p className="font-display text-3xl font-semibold tabular-nums tracking-tight text-ink dark:text-parchment">
              {pct(a.confirmed, a.answered)}%
            </p>
            <p className="text-xs text-ink/65 dark:text-parchment/65">
              {a.confirmed} of {a.answered} confirmed
              {a.alerts > a.answered ? `, ${a.alerts - a.answered} unanswered` : ""}
            </p>
            {a.answered < 10 && <p className="text-xs text-ink/55 dark:text-parchment/55">Few answers so far</p>}
          </div>
          <ul className="space-y-2">
            {a.by_cause.slice(0, 3).map((c) => (
              <li key={c.cause} title={`${CAUSE_WORDS[c.cause] ?? c.cause}: ${c.confirmed} of ${c.answered} confirmed`}>
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-ink dark:text-parchment">{CAUSE_SHORT[c.cause] ?? c.cause}</span>
                  <span className="shrink-0 tabular-nums text-ink/65 dark:text-parchment/65">
                    {pct(c.confirmed, c.answered)}%
                  </span>
                </span>
                <span className="mt-1 block h-1.5 rounded-full bg-parchment dark:bg-white/5" aria-hidden>
                  <span className="block h-1.5 rounded-full bg-growth-600" style={{ width: `${pct(c.confirmed, c.answered)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** The daily satellite check's state as a small pill beside the title. */
function PipelinePill({ run }: { run: Overview["last_run"] }) {
  const hoursSince = run ? (Date.now() - new Date(run.at).getTime()) / 3_600_000 : Infinity;
  const failures = run?.details.failures ?? 0;
  const ok = !!run && hoursSince <= 36 && failures === 0;

  let full: string;
  if (!run) full = "The daily satellite check hasn't reported a run yet.";
  else if (hoursSince > 36) full = `The daily satellite check last ran ${relativeTime(run.at).toLowerCase()}. It should run every day.`;
  else
    full = `Last satellite check ${relativeTime(run.at).toLowerCase()}, ${run.details.fields_checked ?? 0} fields checked, ${
      failures === 0 ? "no failures" : `${failures} failure${failures === 1 ? "" : "s"}`
    }.`;
  const short = ok ? `Satellite check ran ${relativeTime(run!.at).toLowerCase()}` : "Satellite check needs attention";

  return (
    <Link
      to="/admin/health"
      title={run ? `${full} (${exactTime(run.at)})` : full}
      className={`inline-flex h-10 max-w-full items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-growth-500 max-md:h-12 ${
        ok ? "bg-growth-50 text-growth-700 hover:bg-growth-100" : "bg-laterite-50 text-laterite-700 hover:bg-laterite-100"
      }`}
    >
      {ok ? <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-growth-600" /> : <WarningIcon size={16} />}
      <span className="truncate" aria-hidden>
        {short}
      </span>
      <span className="sr-only">
        {ok ? "Healthy. " : "Needs attention. "}
        {full} Open system health.
      </span>
    </Link>
  );
}

function CropList({ crops }: { crops: { crop: string; count: number; ha: number }[] }) {
  const max = Math.max(1, ...crops.map((c) => c.count));
  const shown = crops.slice(0, MAX_CROPS);
  const hidden = crops.length - shown.length;
  return (
    <section className={`${card} h-full p-4 md:p-6 tall:p-4`} aria-labelledby="crops-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="crops-title" className="text-base font-semibold text-ink dark:text-parchment">
          Fields by crop
        </h2>
        {hidden > 0 && (
          <Link to="/admin/fields" className="rounded text-sm font-medium text-growth-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500 dark:text-growth-500">
            +{hidden} more
          </Link>
        )}
      </div>
      {crops.length === 0 ? (
        <p className="mt-4 text-sm text-ink/70 dark:text-parchment/70">No fields yet.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          {shown.map((c) => (
            <li key={c.crop}>
              <Link
                to={`/admin/fields?crop=${encodeURIComponent(c.crop)}`}
                title={`${c.crop}: ${c.count} field${c.count === 1 ? "" : "s"}, ${hectares(c.ha)}`}
                className="block rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-growth-500"
              >
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-ink dark:text-parchment">{c.crop}</span>
                  <span className="shrink-0 tabular-nums text-ink/65 dark:text-parchment/65">
                    {c.count} · {Number(c.ha) >= 10 ? Math.round(Number(c.ha)) : Number(c.ha).toFixed(1)} ha
                  </span>
                </span>
                <span className="mt-1.5 block h-1.5 rounded-full bg-parchment dark:bg-white/5" aria-hidden>
                  <span className="block h-1.5 rounded-full bg-growth-600" style={{ width: `${(c.count / max) * 100}%` }} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OverviewSkeleton() {
  return (
    <LoadingRegion label="Loading overview" className="flex flex-col tall:min-h-0 tall:grow">
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[72px] w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 tall:grow tall:grid-cols-[1fr_1fr_minmax(320px,0.9fr)]">
        <Skeleton className="h-[300px] w-full tall:h-full" />
        <Skeleton className="h-[300px] w-full tall:h-full" />
        <Skeleton className="hidden h-full w-full tall:block" />
      </div>
    </LoadingRegion>
  );
}
