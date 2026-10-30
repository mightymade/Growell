import { useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAllFieldAlerts } from "../hooks/useAllFieldAlerts";
import { useFieldSnapshots } from "../hooks/useFieldSnapshots";
import type { LayoutContext } from "../components/AppLayout";
import IconStatCard from "../components/IconStatCard";
import NotificationBell from "../components/NotificationBell";
import { HomeSkeleton } from "../components/Skeleton";
import SatelliteStatCard from "../components/SatelliteStatCard";
import FieldsOverview from "../components/FieldsOverview";
import RecentAlertsCard from "../components/RecentAlertsCard";
import YearAtAGlance from "../components/YearAtAGlance";
import { LeafIcon, BellIcon, MapIcon, PlusIcon } from "../components/icons";

/**
 * The "at a glance across everything" view. Everything here comes from the
 * shared cache: fields and alerts are already loaded by the layout, and the
 * per-field numbers now arrive in two queries for all fields together.
 */
export default function Home() {
  const navigate = useNavigate();
  const { fields, fieldsLoading } = useOutletContext<LayoutContext>();
  const { alerts, loading: alertsLoading } = useAllFieldAlerts();
  const ids = useMemo(() => fields.map((f) => f.id), [fields]);
  const { data: snap, loading: snapLoading } = useFieldSnapshots(ids);

  const snapshots = useMemo(
    () =>
      fields.map((f) => ({
        id: f.id,
        field_name: f.field_name,
        crop_type: f.crop_type,
        planted_date: f.planted_date,
        area_hectares: f.area_hectares,
        latestNdvi: snap?.latestNdvi[f.id] ?? null,
        prevNdvi: snap?.prevNdvi[f.id] ?? null,
        lastImage: snap?.lastPassByField[f.id] ?? null,
      })),
    [fields, snap],
  );

  const openAlerts = alerts.filter((a) => a.status === "open");
  const fieldsNeedingAttention = new Set(openAlerts.map((a) => a.field_id)).size;

  const lastDates = useMemo(() => Object.values(snap?.lastPassByField ?? {}), [snap]);

  if (fieldsLoading || alertsLoading || snapLoading) return <HomeSkeleton />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-ink dark:text-parchment">Overview</h1>
        <div className="flex items-center gap-2">
          {fields.length > 0 && (
            <button
              onClick={() => navigate("/fields/new")}
              className="flex items-center gap-2 rounded-lg bg-growth-600 px-3 py-2 text-sm font-semibold text-white hover:bg-growth-600/90"
            >
              <PlusIcon size={15} />
              <span className="hidden sm:inline">Add field</span>
            </button>
          )}
          {/* On phones the bell is already in the top bar. */}
          <div className="hidden md:block">
            <NotificationBell />
          </div>
        </div>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-canopy-900/20 dark:border-white/20 bg-white dark:bg-night-900 p-10 text-center">
          <p className="mb-1 font-display font-semibold text-ink dark:text-parchment">No fields yet</p>
          <p className="mb-4 text-sm text-ink/70 dark:text-parchment/70">Add your first field to start tracking it.</p>
          <button
            onClick={() => navigate("/fields/new")}
            className="rounded-lg bg-growth-600 px-4 py-3 text-sm font-semibold text-white hover:bg-growth-600/90"
          >
            + Add your first field
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <IconStatCard icon={<MapIcon />} iconTint="growth" label="Your fields" value={String(fields.length)} />
            <IconStatCard
              icon={<BellIcon />}
              iconTint="laterite"
              label="Alerts to answer"
              value={String(openAlerts.length)}
              trend={{ label: openAlerts.length > 0 ? "Answer" : "All clear", positive: openAlerts.length === 0 }}
            />
            <IconStatCard icon={<LeafIcon />} iconTint="sky" label="Fields needing attention" value={String(fieldsNeedingAttention)} />
            <SatelliteStatCard lastDates={lastDates} />
          </div>

          <YearAtAGlance fields={fields} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <FieldsOverview
              rows={snapshots.map((f) => ({
                id: f.id,
                field_name: f.field_name,
                crop_type: f.crop_type,
                area_hectares: f.area_hectares,
                planted_date: f.planted_date,
                latestNdvi: f.latestNdvi,
                prevNdvi: f.prevNdvi,
                lastImage: f.lastImage,
                openAlerts: openAlerts.filter((a) => a.field_id === f.id).length,
              }))}
              onOpen={(id) => navigate(`/fields/${id}`)}
            />

            <RecentAlertsCard
              alerts={alerts.slice(0, 4)}
              openCount={openAlerts.length}
              onOpenAlert={(a) => navigate(`/alerts?field=${a.field_id}&alert=${a.id}`)}
              onViewAll={() => navigate("/alerts")}
            />
          </div>
        </>
      )}

    </div>
  );
}
