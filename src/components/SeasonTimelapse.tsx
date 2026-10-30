import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { NdviPoint, WeatherPoint } from "../lib/types";
import { fetchFrame, frameKey } from "../lib/api/frames";
import { queryClient } from "../lib/queryClient";
import { ndviColor, ndviLabel, healthWord, NDVI_LEGEND_GRADIENT } from "../lib/ndviColor";

const ESRI_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const FRAME_MS = 900; // how long each picture stays on screen while playing
const PREFETCH = 3; // pictures loaded ahead of the one on screen
const FIT_PADDING = 0.14; // share of the box kept clear around the field on every side
// Highest zoom the photo really has. Past this the tiles are just
// enlarged, which is what made small fields look smeared.
const SHARP_MAX_ZOOM = 19;
// The NDVI layer is see-through so the crop rows and soil underneath
// still show. Strong enough to read, soft enough to look natural.
const NDVI_OPACITY = 0.62;
// A picture must have colour on at least this share of its pixels to be
// shown. The field fills most of its own bounding box, so a good picture
// is usually well above this.
const MIN_PICTURE_COVERAGE = 0.25;

/** Share of a picture's pixels that are not see-through (0 to 1). */
async function pictureCoverage(src: string, cache: Map<string, number>): Promise<number> {
  const known = cache.get(src);
  if (known !== undefined) return known;
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const w = Math.min(img.naturalWidth, 128);
    const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 1;
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    let solid = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 20) solid++;
    const coverage = solid / (w * h);
    cache.set(src, coverage);
    return coverage;
  } catch {
    cache.set(src, 0);
    return 0;
  }
}

type Props = {
  fieldId: string;
  boundary: GeoJSON.Polygon | null;
  ndviHistory: NdviPoint[];
  weatherHistory: WeatherPoint[];
  anomalyDates: string[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
};

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const frameOptions = (fieldId: string, date: string) => ({
  queryKey: frameKey(fieldId, date),
  queryFn: () => fetchFrame(fieldId, date),
  staleTime: Infinity,
  gcTime: 30 * 60 * 1000,
  retry: 0,
});

/**
 * Season timelapse. The base is always the sharp map photo. Over the
 * field only, a soft NDVI layer from each clear Sentinel-2 pass shows how
 * healthy each part of the field was on that day, from brown (bare or
 * stressed) to deep green (dense, healthy). Play steps through the season.
 * The track under the map is coloured by each reading too, so the whole
 * season's health is visible at a glance before pressing play.
 */
export default function SeasonTimelapse({
  fieldId,
  boundary,
  ndviHistory,
  weatherHistory,
  anomalyDates,
  selectedDate,
  onSelectDate,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const outlineRef = useRef<L.GeoJSON | null>(null);
  // Two picture layers, swapped on every frame so the new one fades in
  // over the old one instead of the map flashing empty.
  const overlaysRef = useRef<{ layers: L.ImageOverlay[]; front: number }>({ layers: [], front: 0 });
  const coverageCache = useRef(new Map<string, number>());
  const [playing, setPlaying] = useState(false);
  // True while a detailed per-pixel picture is on screen. Until then (or
  // if it fails) the field is filled with the day's overall health colour.
  const [pictureShown, setPictureShown] = useState(false);

  const dates = useMemo(() => ndviHistory.map((d) => d.capture_date), [ndviHistory]);
  const hasFrames = dates.length > 0;
  const [layerOn, setLayerOn] = useState(true);
  const showSeason = layerOn && hasFrames;

  const found = selectedDate ? dates.indexOf(selectedDate) : -1;
  const index = found === -1 ? dates.length - 1 : found;
  const date = index >= 0 ? dates[index] : null;
  const reading = index >= 0 ? ndviHistory[index] : null;
  const anomalySet = useMemo(() => new Set(anomalyDates), [anomalyDates]);
  const isFlagged = date ? anomalySet.has(date) : false;
  const weather = date ? weatherHistory.find((w) => w.record_date === date) : undefined;
  const canReplay = dates.length >= 2;

  const frame = useQuery({ ...frameOptions(fieldId, date ?? ""), enabled: showSeason && !!date });

  // Boundary as a stable value, so a background refetch of the field list
  // (new object, same shape) doesn't rebuild the map and reset the view.
  const boundaryKey = boundary ? JSON.stringify(boundary.coordinates) : "";

  // ---- Map setup ---------------------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const map = L.map(el, {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: false,
      // Whole zoom levels only. In-between levels stretch the photo
      // tiles, which softens them.
      zoomSnap: 1,
      maxZoom: SHARP_MAX_ZOOM,
    });
    mapRef.current = map;
    L.tileLayer(ESRI_IMAGERY_URL, { maxZoom: SHARP_MAX_ZOOM }).addTo(map);

    for (let i = 0; i < 2; i++) {
      const ov = L.imageOverlay("data:,", [[0, 0], [0, 0]], { className: "timelapse-frame", opacity: 0 });
      ov.addTo(map);
      overlaysRef.current.layers[i] = ov;
    }
    overlaysRef.current.front = 0;

    // The field outline sits in its own pane above the pictures.
    map.createPane("fieldOutline").style.zIndex = "450";

    // Biggest sharp zoom at which the whole field fits with a clear margin
    // on every side (extra at the top for the layer switch). A tiny field
    // shows smaller rather than being blown up into a blur.
    const fit = () => {
      const layer = outlineRef.current;
      if (!layer) return;
      const { x, y } = map.getSize();
      const px = Math.round(x * FIT_PADDING);
      const py = Math.round(y * FIT_PADDING);
      const fieldBounds = layer.getBounds();
      const zoom = Math.min(map.getBoundsZoom(fieldBounds, false, L.point(px * 2, py * 2 + 48)), SHARP_MAX_ZOOM);
      // Centre a little below the middle, so the space taken by the
      // switch at the top is balanced.
      const centre = map.unproject(map.project(fieldBounds.getCenter(), zoom).subtract([0, 24]), zoom);
      map.setView(centre, zoom, { animate: false });
    };

    if (boundary) {
      outlineRef.current = L.geoJSON(boundary, {
        pane: "fieldOutline",
        style: { className: "timelapse-outline", color: "#FFFFFF", weight: 2.5, fillColor: "#9AA39C", fillOpacity: 0 },
      }).addTo(map);
      fit();
    } else {
      map.setView([1.3733, 32.2903], 6);
    }

    // Refit whenever the box changes size (first layout, window resize,
    // sidebar toggle). Only re-sizing without refitting is what cut
    // corners off some fields before.
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
      fit();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      outlineRef.current = null;
      overlaysRef.current = { layers: [], front: 0 };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaryKey]);

  // ---- Show the current picture (cross-fade) ------------------------------
  // Each picture is checked before it is shown. A picture that is mostly
  // see-through (everything masked as cloud, or a bad response) would hide
  // the field's health colour behind nothing, so it is skipped and the
  // plain health colour stays on the field instead.
  useEffect(() => {
    const { layers, front } = overlaysRef.current;
    if (layers.length < 2) return;
    const hideAll = () => {
      layers.forEach((l) => l.setOpacity(0));
      setPictureShown(false);
    };
    if (!showSeason || frame.isError) {
      hideAll();
      return;
    }
    const data = frame.data;
    if (!data) return; // keep the previous picture up while the next loads

    let cancelled = false;
    pictureCoverage(data.image, coverageCache.current).then((coverage) => {
      if (cancelled) return;
      console.info(`field-frame ${date}: ${Math.round(coverage * 100)}% of the picture has colour`);
      if (coverage < MIN_PICTURE_COVERAGE) {
        console.warn(
          `field-frame picture for ${date} skipped: only ${Math.round(coverage * 100)}% of it has colour ` +
            "(cloud-masked or empty). Showing the day's overall health colour instead.",
        );
        hideAll();
        return;
      }
      const current = layers[front];
      if ((current as any)._url === data.image) {
        current.setOpacity(NDVI_OPACITY);
        setPictureShown(true);
        return;
      }
      const back = layers[1 - front];
      back.setBounds(L.latLngBounds(data.bounds));
      back.setUrl(data.image);
      const reveal = () => {
        if (cancelled) return;
        back.setOpacity(NDVI_OPACITY);
        current.setOpacity(0);
        overlaysRef.current.front = 1 - front;
        setPictureShown(true);
      };
      const img = back.getElement();
      if (img && !img.complete) img.addEventListener("load", reveal, { once: true });
      else reveal();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.data, frame.isError, showSeason]);

  useEffect(() => {
    if (frame.isError) console.warn("field-frame failed:", (frame.error as Error).message);
  }, [frame.isError, frame.error]);

  // ---- Field colour and outline ------------------------------------------
  // The field is always coloured on the map by that day's overall health,
  // straight from the saved reading. When the detailed picture is on
  // screen the plain fill steps back so the picture's own detail shows.
  useEffect(() => {
    const layer = outlineRef.current;
    if (!layer) return;
    const ndviNow = reading ? Number(reading.ndvi_value) : null;
    layer.setStyle({
      color: isFlagged ? "#F0915F" : "#FFFFFF",
      weight: isFlagged ? 3.5 : 2.5,
      fillColor: ndviNow !== null ? ndviColor(ndviNow) : "#9AA39C",
      fillOpacity: !layerOn || ndviNow === null ? 0 : pictureShown ? 0 : 0.55,
    });
    layer.eachLayer((l) => (l as L.Path).getElement?.()?.classList.toggle("timelapse-flagged", isFlagged));
  }, [isFlagged, boundaryKey, reading, layerOn, pictureShown]);

  // ---- Load pictures ahead -----------------------------------------------
  useEffect(() => {
    if (!showSeason || index < 0) return;
    for (let i = 1; i <= PREFETCH; i++) {
      const d = dates[index + i];
      if (d) queryClient.prefetchQuery(frameOptions(fieldId, d));
    }
  }, [showSeason, index, dates, fieldId]);

  // ---- Playback ------------------------------------------------------------
  useEffect(() => {
    if (!playing) return;
    if (index >= dates.length - 1) {
      setPlaying(false);
      return;
    }
    const next = dates[index + 1];
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      // Wait for the next picture instead of jumping to a blank frame.
      // A picture that failed to load is skipped rather than stalling.
      const state = queryClient.getQueryState(frameKey(fieldId, next));
      if (!showSeason || state?.status === "success" || state?.status === "error") onSelectDate(next);
      else timer = setTimeout(step, 250);
    };
    timer = setTimeout(step, FRAME_MS);
    return () => clearTimeout(timer);
  }, [playing, index, dates, onSelectDate, fieldId, showSeason]);

  function togglePlay() {
    if (!canReplay) return;
    if (!layerOn) setLayerOn(true);
    if (!playing && index >= dates.length - 1) onSelectDate(dates[0]);
    setPlaying((p) => !p);
  }

  const fillPct = canReplay ? (index / (dates.length - 1)) * 100 : 100;
  const ndvi = reading ? Number(reading.ndvi_value) : null;
  const loadingFrame = showSeason && frame.isFetching && !frame.data;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-white dark:bg-night-900 shadow-e1">
      <div className="relative min-h-72 flex-1 sm:min-h-80 md:min-h-96">
        <div ref={containerRef} className="absolute inset-0 bg-night-950" />

        {hasFrames && (
          <button
            onClick={() => {
              setLayerOn((v) => !v);
              setPlaying(false);
            }}
            aria-pressed={layerOn}
            className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-full bg-canopy-950/70 py-2 pl-2 pr-3 text-xs font-medium text-white backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <span
              className={`relative h-4 w-7 rounded-full transition-colors ${layerOn ? "bg-growth-500" : "bg-white/30"}`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${layerOn ? "left-3.5" : "left-0.5"}`}
              />
            </span>
            Crop health layer
          </button>
        )}

        {showSeason && reading && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[500] w-44 rounded-lg bg-canopy-950/70 px-3 py-2 text-xs text-white/85 backdrop-blur-sm">
            <div className="h-1.5 rounded-full" style={{ background: NDVI_LEGEND_GRADIENT }} />
            <div className="mt-1 flex justify-between">
              <span>Poor</span>
              <span>Fair</span>
              <span>Very good</span>
            </div>
          </div>
        )}

        {loadingFrame && (
          <div className="absolute right-3 top-3 z-[500] flex items-center gap-2 rounded-full bg-canopy-950/70 px-3 py-2 text-xs text-white backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" />
            Loading picture
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {reading ? (
            <p className="text-sm text-ink/70 dark:text-parchment/70">
              <span className="mr-2 font-display text-base font-semibold text-ink dark:text-parchment">
                {formatDay(reading.capture_date)}
              </span>
              Crop health{" "}
              <span className="font-semibold text-ink dark:text-parchment">{healthWord(ndvi!).toLowerCase()}</span>,{" "}
              {ndviLabel(ndvi!)}
              {weather?.rainfall_mm != null && <>. {weather.rainfall_mm.toFixed(0)} mm of rain that day</>}
            </p>
          ) : (
            <p className="text-sm text-ink/70 dark:text-parchment/70">
              No clear satellite photo yet. The field's colour will show here once one arrives.
            </p>
          )}
          {isFlagged && (
            <span className="rounded-full bg-laterite-100 px-2 py-1 text-xs font-medium text-laterite-700">
              Drop flagged on this day
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={!canReplay}
            aria-label={playing ? "Pause season timelapse" : "Play season timelapse"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-growth-600 text-white hover:bg-growth-600/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-growth-600 disabled:opacity-40"
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
                <rect x="2" y="1" width="4" height="12" rx="1" />
                <rect x="8" y="1" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
                <path d="M2.5 1.5v11l9-5.5-9-5.5z" />
              </svg>
            )}
          </button>

          <div className="relative flex-1">
            <input
              type="range"
              aria-label="Choose a satellite pass"
              className="season-slider w-full"
              style={{ ["--slider-fill" as string]: `${fillPct}%` }}
              min={0}
              max={Math.max(dates.length - 1, 0)}
              value={Math.max(index, 0)}
              disabled={!canReplay}
              onChange={(e) => {
                setPlaying(false);
                if (!layerOn) setLayerOn(true);
                onSelectDate(dates[Number(e.target.value)]);
              }}
            />
            {canReplay &&
              dates.map((d, i) =>
                anomalySet.has(d) ? (
                  <span
                    key={d}
                    className="pointer-events-none absolute -top-2.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-laterite-600"
                    // The 18px thumb centre runs from 9px to (width - 9px).
                    style={{ left: `calc(9px + (100% - 18px) * ${i / (dates.length - 1)})` }}
                  />
                ) : null,
              )}
          </div>

          <span className="hidden shrink-0 text-xs text-ink/65 dark:text-parchment/65 sm:block">
            {canReplay ? `${index + 1} of ${dates.length}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
