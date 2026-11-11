import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useFieldDetail } from "../hooks/useFieldDetail";
import { useWeatherForecast } from "../hooks/useWeatherForecast";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { polygonCentroid } from "../lib/geo";
import type { LayoutContext } from "../components/AppLayout";
import NdviChart from "../components/NdviChart";
import RainfallChart from "../components/RainfallChart";
import WeatherSummaryCard from "../components/WeatherSummaryCard";
import ForecastStrip from "../components/ForecastStrip";
import GrowthStageCard from "../components/GrowthStageCard";
import FieldAlertHistory from "../components/FieldAlertHistory";
import { Skeleton, ChartCardSkeleton, FieldGlanceSkeleton } from "../components/Skeleton";
import { useBackfillStatus, useLastCheck } from "../hooks/useBackfillStatus";
import { AUTO_CHECK_MIN_AGE_DAYS, needsAutoCheck, runAutoCheck } from "../lib/autoCheck";
import BrandMark from "../components/BrandMark";
import { WifiOffIcon } from "../components/icons";
import type { ChartRange } from "../lib/chartStyle";

// The map (Leaflet) is a big download. Loading it separately lets the numbers
// and charts appear first, and the map fills in a moment later.
const FieldHealthMap = lazy(() => import("../components/FieldHealthMap"));

// Remembers whichever field you last actually viewed, so landing on
// /fields with no id in the URL picks up where you left off instead of
// always defaulting to the same (e.g. first-created) field.
const LAST_FIELD_KEY = "growell_last_field_id";

/** A date as YYYY-MM-DD in the farmer's own time zone. */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FieldDetail() {
  const navigate = useNavigate();
  const { fieldId } = useParams();
  const isOnline = useOnlineStatus();
  const { fields, fieldsLoading, refetchFields } = useOutletContext<LayoutContext>();
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
  // bookmark to a since-deleted field), fall back to whichever field
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
    setFailedFor(null);
  }, [fieldId]);

  const { ndviHistory, weatherHistory, weather, alerts, problems, error: detailError, loading: detailLoading, refetch } =
    useFieldDetail(fieldId ?? null);
  const backfilling = useBackfillStatus(fieldId ?? null);
  const lastCheck = useLastCheck(fieldId ?? null);
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

  // The period both stacked charts cover, up to today: this season, from
  // a week before planting (up to a year back). With no planting date, the
  // last 90 days. If the newest clear image is older than that, the chart
  // reaches back to show it, so it is never empty when an image exists.
  const plantedDate = selectedField?.planted_date ?? null;
  const chartRange = useMemo<ChartRange>(() => {
    const today = isoDay(new Date());
    let cutoff = plantedDate
      ? isoDay(new Date(new Date(`${plantedDate}T00:00:00Z`).getTime() - 7 * 86_400_000))
      : isoDay(new Date(Date.now() - 90 * 86_400_000));
    const yearAgo = isoDay(new Date(Date.now() - 365 * 86_400_000));
    if (cutoff < yearAgo) cutoff = yearAgo;
    const latestNdvi = ndviHistory[ndviHistory.length - 1]?.capture_date?.slice(0, 10);
    if (latestNdvi && latestNdvi < cutoff) cutoff = latestNdvi;
    const firsts = [ndviHistory[0]?.capture_date, weatherHistory[0]?.record_date]
      .filter((d): d is string => !!d)
      .map((d) => (d < cutoff ? cutoff : d.slice(0, 10)));
    let start = firsts.length ? firsts.sort()[0] : isoDay(new Date(Date.now() - 28 * 86_400_000));
    // At least two weeks, so a brand-new field's chart is not squashed.
    const twoWeeksBack = isoDay(new Date(Date.now() - 14 * 86_400_000));
    if (start > twoWeeksBack) start = twoWeeksBack;
    return { start, end: today };
  }, [ndviHistory, weatherHistory, plantedDate]);

  const centroid = selectedField?.boundary_coords ? polygonCentroid(selectedField.boundary_coords) : null;
  const { forecast, loading: forecastLoading } = useWeatherForecast(centroid?.lat ?? null, centroid?.lon ?? null);

  return (
    // Full height of the visible area on computers, so the at-a-glance
    // area below can stretch to the bottom of the window.
    <div className="flex flex-col lg:h-full">
      {/* Switching and deleting fields: the sidebar on computers, the top
          bar (field name and its menu) on phones. */}

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
          {/* First screen on a computer: notices, then the at-a-glance area
              filling the rest of the window. Alert history is below it, one
              scroll away. On phones and tablets everything simply stacks. */}
          <div className="flex flex-col lg:min-h-full lg:shrink-0">
            {justAdded && !welcomeDismissed && (
              <div className="m-in mb-4 flex items-start gap-3 rounded-lg bg-growth-50 p-4 text-sm text-growth-700" role="status">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-growth-600 text-white" aria-hidden>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m2.5 6.2 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <p className="flex-1">
                  <span className="font-semibold">{selectedField.field_name} is saved.</span> Growell will check it every day and
                  tell you here if crop health drops. Its satellite history is loading now.
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
                <p>Loading satellite and weather history for this field. The charts will fill in as soon as it arrives.</p>
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
                className="mb-4 flex h-12 w-full shrink-0 items-center justify-between gap-3 rounded-lg bg-laterite-50 px-4 text-left text-sm text-laterite-700 hover:bg-laterite-100 active:bg-laterite-100 md:h-10"
              >
                <span className="truncate">
                  <span className="font-semibold">
                    {openAlertCount} open alert{openAlertCount === 1 ? "" : "s"}
                  </span>{" "}
                  on this field need{openAlertCount === 1 ? "s" : ""} a look.
                </span>
                <span className="shrink-0 font-semibold">Review</span>
              </button>
            )}

            <h2 id="season-heading" className="mb-2 text-base font-semibold text-ink dark:text-parchment">
              This season
            </h2>

            {showSkeleton ? (
              <FieldGlanceSkeleton />
            ) : (
              <section
                aria-labelledby="season-heading"
                className="flex flex-col gap-4 lg:grid lg:grow lg:basis-0 lg:grid-cols-2"
              >
                {/* Left: the field now. The map takes the height the two
                    cards under it leave over. */}
                <div className="flex flex-col gap-4 lg:min-h-0">
                  <div className="h-56 md:h-72 lg:h-0 lg:min-h-[240px] lg:grow lg:basis-0">
                    <Suspense fallback={<Skeleton className="h-full w-full rounded-xl" />}>
                      <FieldHealthMap
                        fieldId={selectedField.id}
                        boundary={selectedField.boundary_coords}
                        ndviHistory={ndviHistory}
                        anomalyDates={anomalyDates}
                      />
                    </Suspense>
                  </div>
                  <ForecastStrip forecast={forecast} loading={forecastLoading} />
                  <WeatherSummaryCard weather={weather} drySpellDays={drySpellDays} />
                </div>

                {/* Right: how the season is going. Growth stage on top, then
                    the two charts over the same dates, so a dip in health
                    lines up with the rain under it. */}
                <div className="flex flex-col gap-4 lg:min-h-0">
                  <GrowthStageCard field={selectedField} onUpdated={refetchFields} />
                  <div className="lg:grow lg:basis-0">
                    <NdviChart
                      data={ndviHistory}
                      anomalyDates={anomalyDates}
                      areaHectares={selectedField.area_hectares}
                      plantedDate={selectedField.planted_date}
                      lastCheck={lastCheck ?? null}
                      checking={autoChecking || backfilling}
                      range={chartRange}
                    />
                  </div>
                  <div className="lg:grow lg:basis-0">
                    <RainfallChart data={weatherHistory} range={chartRange} />
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* A short history, one scroll down. Reading and answering alerts
              happens on the Alerts page, which this links to already filtered. */}
          <section id="alerts-panel" className="mt-8 scroll-mt-4" aria-label="Alert history">
            {showSkeleton ? (
              <ChartCardSkeleton height={80} />
            ) : (
              <FieldAlertHistory alerts={alerts} fieldId={fieldId as string} />
            )}
          </section>
        </>
      )}

      {isOnline && fieldsLoading && <FieldGlanceSkeleton />}

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
