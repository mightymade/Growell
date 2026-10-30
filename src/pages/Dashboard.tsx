import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useFieldDetail } from "../hooks/useFieldDetail";
import { useWeatherForecast } from "../hooks/useWeatherForecast";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { polygonCentroid } from "../lib/geo";
import type { LayoutContext } from "../components/AppLayout";
import NdviChart from "../components/NdviChart";
import RainfallChart from "../components/RainfallChart";
import SeasonScrubber from "../components/SeasonScrubber";
import WeatherSummaryCard from "../components/WeatherSummaryCard";
import ForecastStrip from "../components/ForecastStrip";
import GrowthStageCard from "../components/GrowthStageCard";
import AlertsPanel from "../components/AlertsPanel";
import AlertBreakdownDonut from "../components/AlertBreakdownDonut";
import Modal from "../components/Modal";
import RecommendationsList from "../components/RecommendationsList";
import FieldPreviewMap from "../components/FieldPreviewMap";
import IconStatCard from "../components/IconStatCard";
import BrandMark from "../components/BrandMark";
import { LeafIcon, DropletIcon, SunIcon, BellIcon, WifiOffIcon } from "../components/icons";

// How often the dashboard re-reads the database while it's open, so a
// farmer who leaves the tab open sees fresh data without a manual
// button. This is a cheap DB read, not a Sentinel Hub call — real new
// imagery only shows up when the daily-pipeline Cron job runs (once a
// day; Sentinel-2 itself only revisits every 2–5 days), so anything
// faster than a few minutes would just be re-reading the same rows.
const AUTO_REFRESH_MS = 5 * 60 * 1000;

export default function Dashboard() {
  const navigate = useNavigate();
  const { fieldId } = useParams();
  const isOnline = useOnlineStatus();
  const { fields, fieldsLoading, refetchFields } = useOutletContext<LayoutContext>();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);

  // No field in the URL yet (bare /home), or a stale/bad field id (e.g.
  // an old bookmark to a since-deleted field) — send them to their
  // first real field instead of showing a blank page.
  useEffect(() => {
    if (fieldsLoading || fields.length === 0) return;
    const stillExists = fieldId && fields.some((f) => f.id === fieldId);
    if (!stillExists) navigate(`/home/${fields[0].id}`, { replace: true });
  }, [fieldId, fields, fieldsLoading, navigate]);

  const selectedField = fields.find((f) => f.id === fieldId);

  // Reset the scrubber to "most recent" whenever the farmer switches fields.
  useEffect(() => {
    setSelectedDate(null);
  }, [fieldId]);

  const { ndviHistory, weatherHistory, weather, alerts, refetch } = useFieldDetail(fieldId ?? null);

  useEffect(() => {
    if (!fieldId) return;
    const interval = setInterval(refetch, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fieldId, refetch]);

  const latestNdvi = ndviHistory.length > 0 ? ndviHistory[ndviHistory.length - 1].ndvi_value : undefined;
  const latestImageDate = ndviHistory.length > 0 ? ndviHistory[ndviHistory.length - 1].capture_date : null;
  const openAlertCount = alerts.filter((a) => a.status === "open").length;
  const anomalyDates = alerts.map((a) => a.date_detected);

  const daysSincePass = latestImageDate
    ? Math.floor((Date.now() - new Date(latestImageDate + "T00:00:00Z").getTime()) / (1000 * 60 * 60 * 24))
    : null;

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
    const prev = Number(ndviHistory[ndviHistory.length - 2].ndvi_value);
    const curr = Number(ndviHistory[ndviHistory.length - 1].ndvi_value);
    if (prev === 0) return null;
    const pct = ((curr - prev) / prev) * 100;
    return { label: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`, positive: pct >= 0 };
  }, [ndviHistory]);

  const rainfallTrend = useMemo(() => {
    if (weatherHistory.length < 2) return null;
    const prev = weatherHistory[weatherHistory.length - 2].rainfall_mm ?? 0;
    const curr = weatherHistory[weatherHistory.length - 1].rainfall_mm ?? 0;
    if (prev === curr) return null;
    return { label: curr > prev ? "Wetter" : "Drier", positive: curr >= prev };
  }, [weatherHistory]);

  const centroid = selectedField?.boundary_coords ? polygonCentroid(selectedField.boundary_coords) : null;
  const { forecast } = useWeatherForecast(centroid?.lat ?? null, centroid?.lon ?? null);

  return (
    <div>
      {/* Field name shown inline on mobile — desktop gets this from the
          sidebar's highlighted selection instead. */}
      {selectedField && (
        <h1 className="mb-4 font-display text-base font-bold text-ink md:hidden">
          {selectedField.field_name}
          <span className="ml-2 font-body text-sm font-normal text-ink/70">
            {selectedField.crop_type ?? "—"} · {selectedField.area_hectares ?? "?"} ha
          </span>
        </h1>
      )}

      {!isOnline && (
        <div className="rounded-2xl border border-dashed border-laterite-600/30 bg-white p-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-laterite-100 text-laterite-700">
            <WifiOffIcon size={24} />
          </span>
          <p className="mb-1 font-display font-semibold text-ink">No internet connection</p>
          <p className="text-sm text-ink/70">
            Growell needs a connection to load your fields. This will update automatically once you're back
            online.
          </p>
        </div>
      )}

      {isOnline && selectedField && (
        <>
          <div className="mb-4 hidden items-center justify-between md:flex">
            <p
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                daysSincePass === null
                  ? "bg-parchment text-ink/70"
                  : daysSincePass <= 5
                    ? "bg-growth-50 text-growth-700"
                    : daysSincePass <= 8
                      ? "bg-sky-100 text-sky-700"
                      : "bg-laterite-50 text-laterite-700"
              }`}
            >
              {latestImageDate
                ? `Last satellite pass: ${latestImageDate} (${daysSincePass} day${daysSincePass === 1 ? "" : "s"} ago)`
                : "Waiting for the first cloud-free satellite pass over this field."}
            </p>
            <button
              onClick={() => setRecommendationsOpen(true)}
              aria-label="View recommendations"
              className="relative shrink-0 rounded-lg bg-white p-2 text-ink/70 shadow-sm shadow-canopy-900/5 hover:text-ink"
            >
              <BellIcon size={20} />
              {openAlertCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-laterite-600 px-1 text-[10px] font-bold text-white">
                  {openAlertCount}
                </span>
              )}
            </button>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <IconStatCard
              icon={<LeafIcon />}
              iconTint="growth"
              label="Current NDVI"
              value={latestNdvi ? latestNdvi.toFixed(2) : "—"}
              trend={ndviTrend}
            />
            <IconStatCard
              icon={<DropletIcon />}
              iconTint="sky"
              label="Rainfall (latest)"
              value={weather ? `${weather.rainfall_mm?.toFixed(0) ?? "—"} mm` : "—"}
              trend={rainfallTrend}
            />
            <IconStatCard
              icon={<SunIcon />}
              iconTint="canopy"
              label="Dry spell"
              value={drySpellDays === null ? "—" : `${drySpellDays}d`}
              trend={drySpellDays === null ? null : { label: drySpellDays >= 10 ? "Watch" : "OK", positive: drySpellDays < 10 }}
            />
            <IconStatCard
              icon={<BellIcon />}
              iconTint="laterite"
              label="Open alerts"
              value={String(openAlertCount)}
              trend={{ label: openAlertCount > 0 ? "Review" : "All clear", positive: openAlertCount === 0 }}
            />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-4 md:col-span-2">
              <SeasonScrubber
                ndviHistory={ndviHistory}
                weatherHistory={weatherHistory}
                anomalyDates={anomalyDates}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
              <NdviChart data={ndviHistory} anomalyDates={anomalyDates} selectedDate={selectedDate} />
              <RainfallChart data={weatherHistory} selectedDate={selectedDate} />
            </div>
            <div className="space-y-4">
              <ForecastStrip forecast={forecast} loading={forecast.length === 0} />
              <div className="h-48 overflow-hidden rounded-2xl shadow-sm shadow-canopy-900/5">
                <FieldPreviewMap boundary={selectedField.boundary_coords} />
              </div>
              <GrowthStageCard field={selectedField} onUpdated={refetchFields} />
              <AlertBreakdownDonut alerts={alerts} />
              <WeatherSummaryCard weather={weather} />
            </div>
          </div>

          <div id="alerts-panel">
            <AlertsPanel alerts={alerts} onFeedbackSubmitted={refetch} />
          </div>
        </>
      )}

      {isOnline && !selectedField && !fieldsLoading && (
        <div className="rounded-2xl border border-dashed border-canopy-900/20 bg-white p-10 text-center">
          <BrandMark size={40} className="mx-auto mb-3 text-growth-600" />
          <p className="mb-1 font-display font-semibold text-ink">No fields yet</p>
          <p className="mb-4 text-sm text-ink/70">
            Add your first field and trace its boundary on the satellite map to start tracking it.
          </p>
          <button
            onClick={() => navigate("/fields/new")}
            className="rounded-xl bg-growth-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-growth-600/90"
          >
            + Add your first field
          </button>
        </div>
      )}

      <Modal open={recommendationsOpen} onClose={() => setRecommendationsOpen(false)} title="Recommendations">
        <RecommendationsList alerts={alerts} />
      </Modal>
    </div>
  );
}
