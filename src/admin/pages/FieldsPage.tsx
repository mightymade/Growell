import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { adminApi } from "../api";
import { FieldsMap } from "../maps";
import { TableSkeleton } from "./UsersPage";
import { fullDate, hectares, shortId } from "../format";
import { Badge, CopyButton, EmptyState, ErrorState, Health, PageHeader, Pagination, SearchBox, Segmented, When, btnGhost, card, num, rowLink, td, th, useUrlState } from "../ui";
import Select from "../../components/Select";
import { Skeleton } from "../../components/Skeleton";
import { ChevronRightIcon } from "../../components/icons";

const PAGE = 25;
const MAP_LIMIT = 2000;

const STATUSES = [
  { value: "live", label: "Live fields" },
  { value: "alerts", label: "With open alerts" },
  { value: "deleted", label: "Deleted" },
  { value: "all", label: "All fields" },
];

export default function FieldsPage() {
  const navigate = useNavigate();
  const url = useUrlState();
  const view = url.get("view", "table") === "map" ? "map" : "table";
  const search = url.get("q");
  const crop = url.get("crop");
  const status = url.get("status", "live");
  const offset = Math.max(0, Number(url.get("page", "0")) || 0);
  const filtered = !!(search || crop || status !== "live");

  const q = useQuery({
    queryKey: ["admin", "fields", view, search, crop, status, view === "map" ? 0 : offset],
    queryFn: () =>
      adminApi.fields({ search, crop, status, limit: view === "map" ? MAP_LIMIT : PAGE, offset: view === "map" ? 0 : offset }),
    placeholderData: keepPreviousData,
  });
  const rows = q.data?.rows ?? [];
  const crops = q.data?.crops ?? [];

  return (
    <div className="flex flex-col tall:h-full tall:min-h-0">
      <PageHeader
        title="Fields"
        description="Every field farmers have drawn, with its latest crop health."
        actions={
          <Segmented
            label="View"
            value={view}
            onChange={(v) => url.set({ view: v === "table" ? null : v }, true)}
            options={[
              { value: "table", label: "Table" },
              { value: "map", label: "Map" },
            ]}
          />
        }
      />

      <div className="mb-4 flex shrink-0 flex-col gap-2 md:flex-row md:items-center">
        <SearchBox value={search} onChange={(v) => url.set({ q: v })} placeholder="Field name, field ID or owner" label="Search fields" />
        <div className="grid grid-cols-2 gap-2 md:flex">
          <div className="md:w-44">
            <Select
              options={[{ value: "", label: "All crops" }, ...[...crops].sort().map((c) => ({ value: c, label: c }))]}
              value={crop}
              onChange={(v) => url.set({ crop: v })}
              ariaLabel="Filter by crop"
            />
          </div>
          <div className="md:w-48">
            <Select options={STATUSES} value={status} onChange={(v) => url.set({ status: v === "live" ? null : v })} ariaLabel="Filter by status" />
          </div>
        </div>
        {filtered && (
          <button type="button" className={btnGhost} onClick={() => url.set({ q: null, crop: null, status: null })}>
            Clear filters
          </button>
        )}
      </div>

      {q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        view === "map" ? <Skeleton className="h-[560px] w-full" /> : <TableSkeleton />
      ) : rows.length === 0 ? (
        <div className={card}>
          <EmptyState
            title={filtered ? "No fields match these filters." : "No fields yet."}
            action={filtered ? <button className={btnGhost} onClick={() => url.set({ q: null, crop: null, status: null })}>Clear filters</button> : undefined}
          />
        </div>
      ) : view === "map" ? (
        <div className="h-[calc(100dvh-260px)] min-h-[420px] tall:h-0 tall:min-h-[360px] tall:grow tall:basis-0">
          <FieldsMap fields={rows} onOpen={(id) => navigate(`/admin/fields/${id}`)} />
        </div>
      ) : (
        <div className={`${card} flex flex-col overflow-hidden tall:min-h-0 tall:grow tall:basis-0 ${q.isPlaceholderData ? "opacity-60 transition-opacity" : ""}`}>
          <div className="relative hidden min-h-0 flex-1 overflow-auto md:block">
            <table className="w-full min-w-[980px]">
              <caption className="sr-only">Fields, {q.data.total} in total</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>Field</th>
                  <th scope="col" className={th}>Owner</th>
                  <th scope="col" className={th}>Crop</th>
                  <th scope="col" className={`${th} ${num}`}>Area</th>
                  <th scope="col" className={th}>Planted</th>
                  <th scope="col" className={th}>Crop health</th>
                  <th scope="col" className={th}>Last image</th>
                  <th scope="col" className={`${th} ${num}`}>Open alerts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id} className={`${rowLink} h-12 ${f.deleted_at ? "text-ink/60" : ""}`} onClick={() => navigate(`/admin/fields/${f.id}`)}>
                    <td className={td}>
                      <Link to={`/admin/fields/${f.id}`} className="flex items-center gap-2 rounded font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500">
                        {f.name}
                        {f.deleted_at && <Badge tone="delete">Deleted</Badge>}
                      </Link>
                      <span className="flex items-center gap-1 text-xs text-ink/55 dark:text-parchment/55">
                        <code>{shortId(f.id)}</code>
                        <CopyButton text={f.id} label={`Copy ID of ${f.name}`} />
                      </span>
                    </td>
                    <td className={td}>
                      <Link
                        to={`/admin/users/${f.owner_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500"
                      >
                        {f.owner_name}
                      </Link>
                    </td>
                    <td className={td}>{f.crop ?? "Other"}</td>
                    <td className={`${td} ${num}`}>{hectares(f.area_ha)}</td>
                    <td className={`${td} whitespace-nowrap`}>{f.planting_date ? fullDate(f.planting_date) : <span className="text-ink/55 dark:text-parchment/55">Not set</span>}</td>
                    <td className={td}><Health ndvi={f.latest_ndvi} /></td>
                    <td className={td}><When iso={f.last_image} fallback="None yet" /></td>
                    <td className={`${td} ${num}`}>
                      {f.open_alerts > 0 ? <Badge tone="delete">{f.open_alerts}</Badge> : <span className="text-ink/55 dark:text-parchment/55">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-canopy-900/5 dark:divide-white/5 md:hidden">
            {rows.map((f) => (
              <li key={f.id}>
                <Link to={`/admin/fields/${f.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-parchment dark:active:bg-white/5">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium text-ink dark:text-parchment">
                      <span className="truncate">{f.name}</span>
                      {f.deleted_at && <Badge tone="delete">Deleted</Badge>}
                    </span>
                    <span className="block truncate text-sm text-ink/60 dark:text-parchment/60">
                      {f.owner_name}. {f.crop ?? "Other"}, {hectares(f.area_ha)}
                    </span>
                    <span className="mt-1 flex items-center gap-3 text-sm text-ink/70 dark:text-parchment/70">
                      <Health ndvi={f.latest_ndvi} />
                      {f.open_alerts > 0 && <Badge tone="delete">{f.open_alerts} open</Badge>}
                    </span>
                  </span>
                  <span className="text-ink/40 dark:text-parchment/40" aria-hidden>
                    <ChevronRightIcon />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="shrink-0"><Pagination offset={offset} limit={PAGE} total={q.data.total} noun="fields" onChange={(o) => url.set({ page: o ? String(o) : null }, false)} /></div>
        </div>
      )}
    </div>
  );
}
