import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useFieldDetail } from "../hooks/useFieldDetail";
import { useWeatherForecast } from "../hooks/useWeatherForecast";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { polygonCentroid } from "../lib/geo";
import type { LayoutContext } from "../components/AppLayout";
import Select from "../components/Select";
import NdviChart from "../components/NdviChart";
import RainfallChart from "../components/RainfallChart";
import WeatherSummaryCard from "../components/WeatherSummaryCard";
import ForecastStrip from "../components/ForecastStrip";
import GrowthStageCard from "../components/GrowthStageCard";
import FieldAlertHistory from "../components/FieldAlertHistory";
import { StatRowSkeleton, ChartCardSkeleton, FieldBodySkeleton } from "../components/Skeleton";
import { useBackfillStatus } from "../hooks/useBackfillStatus";
import DeleteFieldDialog from "../components/DeleteFieldDialog";
import { AUTO_CHECK_MIN_AGE_DAYS, needsAutoCheck, runAutoCheck } from "../lib/autoCheck";

import { healthTrend, healthWord } from "../lib/ndviColor";
import IconStatCard from "../components/IconStatCard";
import BrandMark from "../components/BrandMark";
import { LeafIcon, DropletIcon, SunIcon, BellIcon, WifiOffIcon, TrashIcon } from "../components/icons";

// The map (Leaflet) is a big download. Loading it separately lets the numbers
// and charts appear first, and the map fills in a moment later.
const SeasonTimelapse = lazy(() => import("../components/SeasonTimelapse"));

// Remembers whichever field you last actually viewed, so landing on
// /fields with no id in the URL picks up where you left off instead of
// always defaulting to the same (e.g. first-created) field.
const LAST_FIELD_KEY = "growell_last_field_id";

export default function FieldDetail() {
  const navigate = useNavigate();
  const { fieldId } = useParams();
  const isOnline = useOnlineStatus();
  const { fields, fieldsLoading, refetchFields } = useOutletContext<LayoutContext>();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // True while the once-per-login check for new images is running. It
  // stays quiet: a small note in the "This season" row, no big banner.
  const [checkingFor, setCheckingFor] = useState<string | null>(null);
  // The field whose check failed every attempt; tried again when it is
  // opened again or the connection comes back.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const autoChecking = checkingFor !== null && checkingFor === fieldId;
  useEffect(() => {
    if (isOnline) setFailedFor(null);
  }, [isOnline]);
  // Shown right after a field is added (AddField passes this in).
  const location = useLocation();
  const justAdded = (location.state as { justAdded?: string } | null)?.justAdded === fieldId;
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  // No field in the URL yet, or a stale/bad field id (e.g. an old
  // bookmark to a since-deleted field) — fall back to whichever field
  // was last viewed on this device, or the first field if there's no
  // record of one yet.
  useEffect(() => {
    if (fieldsLoading || fields.length === 0) return;
    const stillExists = fieldId && fields.some((f) => f.id === fieldId);
    if (!stillExists) {
      const lastId = localStorage.getItem(LAST_FIELD_KEY);
      const fallbackId = lastId && fields.some((f) => f.id === lastId) ? lastId : fields[0].id;
      navigate(`/fields/${fallbackId}`, { replace: true });
    }
  }, [fieldId, fields, fieldsLoading, navigate]);

  // Whenever we're actually showing a real field, remember it.
  useEffect(() => {
    if (fieldId && fields.some((f) => f.id === fieldId)) {
      localStorage.setItem(LAST_FIELD_KEY, fieldId);
    }
  }, [fieldId, fields]);

  const selectedField = fields.find((f) => f.id === fieldId);

  // Reset the scrubber to "most recent" whenever the farmer switches fields.
  useEffect(() => {
    setSelectedDate(null);
    setConfirmingDelete(false);
    setFailedFor(null);
  }, [fieldId]);

  const { ndviHistory, weatherHistory, weather, alerts, problems, error: detailError, loading: detailLoading, refetch } =
    useFieldDetail(fieldId ?? null);
  const backfilling = useBackfillStatus(fieldId ?? null);
  // Skeleton while loading, and also while a brand-new field's history is
  // still being downloaded (otherwise the charts would claim "no imagery").
  const showSkeleton = detailLoading || (backfilling && ndviHistory.length === 0);

  const latestImageDate = ndviHistory.length > 0 ? ndviHistory[ndviHistory.length - 1].capture_date : null;
  const latestImageAge =
    latestImageDate !== null && latestImageDate !== undefined
      ? Math.max(0, Math.round((Date.now() - new Date(`${latestImageDate}T00:00:00`).getTime()) / 86_400_000))
      : null;
  // Check for new images by itself the first time this field is opened
  // after logging in, if the newest photo is old enough for a newer pass.
  // Retries are handled in lib/autoCheck. If every attempt fails, it waits
  // for the connection to come back or for the field to be opened again,
  // so a broken service never causes a loop of requests.
  useEffect(() => {
    if (!fieldId || !isOnline || detailLoading || backfilling) return;
    if (checkingFor === fieldId || failedFor === fieldId) return;
    if (latestImageAge !== null && latestImageAge < AUTO_CHECK_MIN_AGE_DAYS) return;
    let cancelled = false;
    needsAutoCheck(fieldId).then(async (go) => {
      if (!go || cancelled) return;
      setCheckingFor(fieldId);
      const worked = await runAutoCheck(fieldId);
      setCheckingFor((cur) => (cur === fieldId ? null : cur));
      if (!worked) setFailedFor(fieldId);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, isOnline, detailLoading, backfilling, checkingFor, failedFor]);

  const latestNdvi = ndviHistory.length > 0 ? ndviHistory[ndviHistory.length - 1].ndvi_value : undefined;
  const openAlertCount = alerts.filter((a) => a.status === "open").length;
  const anomalyDates = alerts.map((a) => a.date_detected);


  const drySpellDays = useMemo(() => {
    if (weatherHistory.length === 0) return null;
    let count = 0;
    for (let i = weatherHistory.length - 1; i >= 0; i--) {
      if ((weatherHistory[i].rainfall_mm ?? 0) < 1) count++;
      else break;
    }
    return count;
  }, [weatherHistory]);

  const ndviTrend = useMemo(() => {
    if (ndviHistory.length < 2) return null;
    return healthTrend(
      Number(ndviHistory[ndviHistory.length - 2].ndvi_value),
      Number(ndviHistory[ndviHistory.length - 1].ndvi_value),
    );
  }, [ndviHistory]);

  const rainfallTrend = useMemo(() => {
    if (weatherHistory.length < 2) return null;
    const prev = weatherHistory[weatherHistory.length - 2].rainfall_mm ?? 0;
    const curr = weatherHistory[weatherHistory.length - 1].rainfall_mm ?? 0;
    if (prev === curr) return null;
    return { label: curr > prev ? "Wetter" : "Drier", positive: curr >= prev };
  }, [weatherHistory]);

  const centroid = selectedField?.boundary_coords ? polygonCentroid(selectedField.boundary_coords) : null;
  const { forecast, loading: forecastLoading } = useWeatherForecast(centroid?.lat ?? null, centroid?.lon ?? null);

  return (
    <div>
      {/* Phones have no sidebar, so they keep a field picker at the top.
          On a computer the sidebar already shows which field is open. */}
      {fields.length > 0 && (
        <div className="mb-4 flex items-center gap-2 md:hidden">
          <Select
            options={fields.map((f) => ({ label: f.field_name, value: f.id }))}
            value={fieldId ?? ""}
            onChange={(id) => navigate(`/fields/${id}`)}
            className="min-w-0 flex-1"
            ariaLabel="Choose a field"
          />
          {selectedField && (
            <button
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete ${selectedField.field_name}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink/65 hover:bg-laterite-50 hover:text-laterite-700 dark:text-parchment/65"
            >
              <TrashIcon size={16} />
            </button>
          )}
        </div>
      )}
      <DeleteFieldDialog field={confirmingDelete ? (selectedField ?? null) : null} onClose={() => setConfirmingDelete(false)} />

      {!isOnline && !selectedField && (
        <div className="rounded-xl border border-dashed border-laterite-600/30 bg-white dark:bg-night-900 p-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-laterite-100 text-laterite-700">
            <WifiOffIcon size={24} />
          </span>
          <p className="mb-1 font-display font-semibold text-ink dark:text-parchment">No internet connection</p>
          <p className="text-sm text-ink/70 dark:text-parchment/70">
            Growell needs a connection to load your fields. This will update automatically once you're back
            online.
          </p>
        </div>
      )}

      {selectedField && (
        <>
          {justAdded && !welcomeDismissed && (
            <div className="m-in mb-4 flex items-start gap-3 rounded-lg bg-growth-50 p-4 text-sm text-growth-700" role="status">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-growth-600 text-white" aria-hidden>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m2.5 6.2 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <p className="flex-1">
                <span className="font-semibold">{selectedField.field_name} is saved.</span> Growell will check it every day and
                tell you here if crop health drops. Its last 90 days of history are loading now.
              </p>
              <button
                onClick={() => setWelcomeDismissed(true)}
                aria-label="Dismiss"
                className="-mr-2 -mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-growth-100"
              >
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden><path d="m4 4 10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </div>
          )}
          {backfilling && !autoChecking && (
            <div className="mb-4 flex items-start gap-3 rounded-lg bg-sky-100 p-3 text-sm text-sky-700">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-600 motion-safe:animate-pulse" aria-hidden />
              <p>Loading 90 days of satellite and weather history for this field. The charts will fill in as soon as it arrives.</p>
            </div>
          )}

          {(detailError || problems.length > 0) && !showSkeleton && (
            <div className="mb-4 rounded-lg bg-laterite-50 p-3 text-sm text-laterite-700">
              {detailError ?? problems.join(" ")} The rest of the page still shows what did load.
            </div>
          )}

          {openAlertCount > 0 && !showSkeleton && (
            <button
              onClick={() => navigate(`/alerts?field=${fieldId}`)}
              className="mb-4 flex w-full items-center justify-between gap-3 rounded-lg bg-laterite-50 px-4 py-3 text-left text-sm text-laterite-700 hover:bg-laterite-100"
            >
              <span>
                <span className="font-semibold">
                  {openAlertCount} open alert{openAlertCount === 1 ? "" : "s"}
                </span>{" "}
                on this field need{openAlertCount === 1 ? "s" : ""} a look.
              </span>
              <span className="shrink-0 font-semibold">Review</span>
            </button>
          )}

          {showSkeleton ? (
            <div className="mb-8">
              <StatRowSkeleton />
            </div>
          ) : (
            <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <IconStatCard
                icon={<LeafIcon />}
                iconTint="growth"
                label="Crop health"
                value={latestNdvi !== undefined ? healthWord(latestNdvi) : "Not yet"}
                trend={ndviTrend}
              />
              <IconStatCard
                icon={<DropletIcon />}
                iconTint="sky"
                label="Latest rain"
                value={weather && weather.rainfall_mm !== null ? `${weather.rainfall_mm.toFixed(1)} mm` : "No data"}
                trend={rainfallTrend}
              />
              <IconStatCard
                icon={<SunIcon />}
                iconTint="canopy"
                label="Days without rain"
                value={drySpellDays === null ? "No data" : `${drySpellDays} day${drySpellDays === 1 ? "" : "s"}`}
                trend={drySpellDays === null ? null : { label: drySpellDays >= 10 ? "Watch" : "Fine", positive: drySpellDays < 10 }}
              />
              <IconStatCard
                icon={<BellIcon />}
                iconTint="laterite"
                label="Alerts to answer"
                value={String(openAlertCount)}
                trend={{ label: openAlertCount > 0 ? "Answer" : "All clear", positive: openAlertCount === 0 }}
              />
            </div>
          )}

          {/* Season: the field over time, with what's happening to it now. */}
          <section className="mb-8" aria-labelledby="season-heading">
            <h2 id="season-heading" className="mb-3 font-display text-base font-semibold text-ink dark:text-parchment">
              This season
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 [&>*]:h-full">
                {showSkeleton ? (
                  <ChartCardSkeleton height={420} />
                ) : (
                  <Suspense fallback={<ChartCardSkeleton height={420} />}>
                    <SeasonTimelapse
                      fieldId={selectedField.id}
                      boundary={selectedField.boundary_coords}
                      ndviHistory={ndviHistory}
                      weatherHistory={weatherHistory}
                      anomalyDates={anomalyDates}
                      selectedDate={selectedDate}
                      onSelectDate={setSelectedDate}
                    />
                  </Suspense>
                )}
              </div>
              {/* The rail stretches to the map card's height; the last card takes
                  up the extra space so both columns end on the same line. */}
              <div className="flex flex-col gap-4">
                <GrowthStageCard field={selectedField} onUpdated={refetchFields} />
                <ForecastStrip forecast={forecast} loading={forecastLoading} />
                {showSkeleton ? <ChartCardSkeleton height={90} /> : <WeatherSummaryCard weather={weather} className="lg:flex-1" />}
              </div>
            </div>
          </section>

          {/* Trends: the numbers behind the season view. The slider above
              moves the marker on both charts. */}
          <section className="mb-8" aria-labelledby="trends-heading">
            <SectionHeading id="trends-heading" title="Health and rain over time" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {showSkeleton ? (
                <>
                  <ChartCardSkeleton height={220} />
                  <ChartCardSkeleton height={220} />
                </>
              ) : (
                <>
                  <NdviChart
                    data={ndviHistory}
                    anomalyDates={anomalyDates}
                    selectedDate={selectedDate}
                    areaHectares={selectedField.area_hectares}
                  />
                  <RainfallChart data={weatherHistory} selectedDate={selectedDate} />
                </>
              )}
            </div>
          </section>

          {/* A short history. Reading and answering alerts happens on the
              Alerts page, which this links to already filtered. */}
          <section id="alerts-panel" className="scroll-mt-4" aria-label="Alert history">
            {showSkeleton ? (
              <ChartCardSkeleton height={80} />
            ) : (
              <FieldAlertHistory alerts={alerts} fieldId={fieldId as string} />
            )}
          </section>


        </>
      )}

      {isOnline && fieldsLoading && <FieldBodySkeleton />}

      {isOnline && !selectedField && !fieldsLoading && (
        <div className="rounded-xl border border-dashed border-canopy-900/20 dark:border-white/20 bg-white dark:bg-night-900 p-10 text-center">
          <BrandMark size={40} className="mx-auto mb-3 text-growth-600" />
          <p className="mb-1 font-display font-semibold text-ink dark:text-parchment">No fields yet</p>
          <p className="mb-4 text-sm text-ink/70 dark:text-parchment/70">
            Add your first field and trace its boundary on the satellite map to start tracking it.
          </p>
          <button
            onClick={() => navigate("/fields/new")}
            className="rounded-lg bg-growth-600 px-4 py-3 text-sm font-semibold text-white hover:bg-growth-600/90"
          >
            + Add your first field
          </button>
        </div>
      )}

    </div>
  );
}

/** Title for one part of the field page. */
function SectionHeading({ id, title }: { id: string; title: string }) {
  return (
    <h2 id={id} className="mb-3 font-display text-base font-semibold text-ink dark:text-parchment">
      {title}
    </h2>
  );
}
