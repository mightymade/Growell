import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { adminApi } from "../api";
import { count, hectares } from "../format";
import { Badge, InfoTip, EmptyState, ErrorState, PageHeader, Pagination, SearchBox, When, btnGhost, card, num, rowLink, td, th, useUrlState } from "../ui";
import Select from "../../components/Select";
import { Skeleton, LoadingRegion } from "../../components/Skeleton";
import { ChevronRightIcon } from "../../components/icons";

const PAGE = 25;

const SORTS = [
  { value: "joined", label: "Newest first" },
  { value: "last_active", label: "Last active" },
  { value: "fields", label: "Most fields" },
  { value: "name", label: "Name, A to Z" },
];

export default function UsersPage() {
  const navigate = useNavigate();
  const url = useUrlState();
  const search = url.get("q");
  const sort = url.get("sort", "joined");
  const offset = Math.max(0, Number(url.get("page", "0")) || 0);

  const q = useQuery({
    queryKey: ["admin", "users", search, sort, offset],
    queryFn: () => adminApi.users({ search, sort, limit: PAGE, offset }),
    placeholderData: keepPreviousData,
  });
  const rows = q.data?.rows ?? [];

  return (
    <div className="flex flex-col tall:h-full tall:min-h-0">
      <PageHeader title="Users" description="Everyone with a Growell account." />

      <div className="mb-4 flex shrink-0 flex-col gap-2 md:flex-row md:items-center">
        <SearchBox value={search} onChange={(v) => url.set({ q: v })} placeholder="Name or email" label="Search users by name or email" />
        <div className="md:w-48">
          <Select options={SORTS} value={sort} onChange={(v) => url.set({ sort: v === "joined" ? null : v })} ariaLabel="Sort users" />
        </div>
      </div>

      {q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <div className={card}>
          <EmptyState
            title={search ? `No users match "${search}".` : "No users yet."}
            action={search ? <button className={btnGhost} onClick={() => url.set({ q: null })}>Clear search</button> : undefined}
          />
        </div>
      ) : (
        <div className={`${card} flex flex-col overflow-hidden tall:min-h-0 tall:grow tall:basis-0 ${q.isPlaceholderData ? "opacity-60 transition-opacity" : ""}`}>
          {/* Computers: a table. Only its rows scroll; the header stays. */}
          <div className="relative hidden min-h-0 flex-1 overflow-auto md:block">
            <table className="w-full min-w-[760px]">
              <caption className="sr-only">Users, {q.data.total} in total</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>Name</th>
                  <th scope="col" className={th}>Joined</th>
                  <th scope="col" className={th}>
                    <span className="inline-flex items-center gap-1">
                      Last active
                      <InfoTip label="About last active" text="Based on sign-ins and actions. Closing the app does not count as logging out." />
                    </span>
                  </th>
                  <th scope="col" className={`${th} ${num}`}>Fields</th>
                  <th scope="col" className={`${th} ${num}`}>Area</th>
                  <th scope="col" className={`${th} ${num}`}>Open alerts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className={`${rowLink} h-12`} onClick={() => navigate(`/admin/users/${u.id}`)}>
                    <td className={td}>
                      <Link to={`/admin/users/${u.id}`} className="block rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500">
                        <span className="flex items-center gap-2 font-medium">
                          {u.name}
                          {!u.is_active && <Badge>Deactivated</Badge>}
                        </span>
                        <span className="block text-xs text-ink/60 dark:text-parchment/60">{u.email}</span>
                      </Link>
                    </td>
                    <td className={td}><When iso={u.joined} /></td>
                    <td className={td}><When iso={u.last_active} /></td>
                    <td className={`${td} ${num}`}>{count(u.field_count)}</td>
                    <td className={`${td} ${num}`}>{u.field_count > 0 ? hectares(u.total_ha) : "None"}</td>
                    <td className={`${td} ${num}`}>
                      {u.open_alerts > 0 ? <Badge tone="delete">{u.open_alerts}</Badge> : <span className="text-ink/55 dark:text-parchment/55">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: cards */}
          <ul className="divide-y divide-canopy-900/5 dark:divide-white/5 md:hidden">
            {rows.map((u) => (
              <li key={u.id}>
                <Link to={`/admin/users/${u.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-parchment dark:active:bg-white/5">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium text-ink dark:text-parchment">
                      <span className="truncate">{u.name}</span>
                      {!u.is_active && <Badge>Deactivated</Badge>}
                    </span>
                    <span className="block truncate text-sm text-ink/60 dark:text-parchment/60">{u.email}</span>
                    <span className="mt-1 block text-sm text-ink/70 dark:text-parchment/70">
                      {u.field_count} field{u.field_count === 1 ? "" : "s"}
                      {u.open_alerts > 0 ? `, ${u.open_alerts} open alert${u.open_alerts === 1 ? "" : "s"}` : ""}. Last active: <When iso={u.last_active} />
                    </span>
                  </span>
                  <span className="text-ink/40 dark:text-parchment/40" aria-hidden>
                    <ChevronRightIcon />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="shrink-0"><Pagination offset={offset} limit={PAGE} total={q.data.total} noun="users" onChange={(o) => url.set({ page: o ? String(o) : null }, false)} /></div>
        </div>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading">
      <div className={`${card} space-y-3 p-4`}>
        <Skeleton className="h-6 w-full" />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </LoadingRegion>
  );
}
