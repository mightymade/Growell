import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { NdviPoint } from "../lib/types";
import { fetchFrame, frameKey } from "../lib/api/frames";
import { ndviColor, NDVI_LEGEND_GRADIENT } from "../lib/ndviColor";
import { shortDay } from "../lib/chartStyle";

const ESRI_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const FIT_PADDING = 0.14; // share of the box kept clear around the field on every side
// Highest zoom the photo really has. Past this the tiles are just
// enlarged, which is what made small fields look smeared.
const SHARP_MAX_ZOOM = 19;
// The crop health layer is see-through so the crop rows and soil
// underneath still show. Strong enough to read, soft enough to look natural.
const NDVI_OPACITY = 0.62;
// A picture must have colour on at least this share of its pixels to be
// shown. The field fills most of its own bounding box, so a good picture
// is usually well above this.
const MIN_PICTURE_COVERAGE = 0.25;
// Space kept clear at the top for the layer switch and at the bottom for
// the legend, so neither covers the field.
const TOP_RESERVE = 60;
const BOTTOM_RESERVE = 64;

/** Share of a picture's pixels that are not see-through (0 to 1). */
async function pictureCoverage(src: string): Promise<number> {
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
    return solid / (w * h);
  } catch {
    return 0;
  }
}

type Props = {
  fieldId: string;
  boundary: GeoJSON.Polygon | null;
  ndviHistory: NdviPoint[];
  anomalyDates: string[];
};

/**
 * The field on a sharp satellite photo, with a soft crop health layer
 * from the most recent clear Sentinel-2 pass: brown where plants are
 * sparse or stressed, deep green where they are dense and healthy. How
 * health changed over the season is shown by the charts below.
 */
export default function FieldHealthMap({ fieldId, boundary, ndviHistory, anomalyDates }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const outlineRef = useRef<L.GeoJSON | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  // True while the detailed per-pixel picture is on screen. Until then (or
  // if it fails) the field is filled with the reading's overall health colour.
  const [pictureShown, setPictureShown] = useState(false);
  const [layerOn, setLayerOn] = useState(true);

  const latest = ndviHistory.length > 0 ? ndviHistory[ndviHistory.length - 1] : null;
  const date = latest?.capture_date ?? null;
  const ndvi = latest ? Number(latest.ndvi_value) : null;
  const isFlagged = date ? anomalyDates.includes(date) : false;
  const showLayer = layerOn && !!latest;

  const frame = useQuery({
    queryKey: frameKey(fieldId, date ?? ""),
    queryFn: () => fetchFrame(fieldId, date as string),
    enabled: showLayer && !!date,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 0,
  });

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
    overlayRef.current = L.imageOverlay("data:,", [[0, 0], [0, 0]], { className: "fieldmap-picture", opacity: 0 }).addTo(map);

    // The field outline sits in its own pane above the picture.
    map.createPane("fieldOutline").style.zIndex = "450";

    // Biggest sharp zoom at which the whole field fits with a clear margin
    // on every side, plus room for the switch at the top and the legend at
    // the bottom. A tiny field shows smaller rather than being blown up
    // into a blur.
    const fit = () => {
      const layer = outlineRef.current;
      if (!layer) return;
      const { x, y } = map.getSize();
      if (x === 0 || y === 0) return;
      const px = Math.round(x * FIT_PADDING);
      const py = Math.round(y * FIT_PADDING);
      const fieldBounds = layer.getBounds();
      const zoom = Math.min(
        map.getBoundsZoom(fieldBounds, false, L.point(px * 2, py * 2 + TOP_RESERVE + BOTTOM_RESERVE)),
        SHARP_MAX_ZOOM,
      );
      // Shift the centre so the field sits in the middle of the space left
      // between the switch and the legend.
      const shift = (BOTTOM_RESERVE - TOP_RESERVE) / 2;
      const centre = map.unproject(map.project(fieldBounds.getCenter(), zoom).add([0, shift]), zoom);
      map.setView(centre, zoom, { animate: false });
    };

    if (boundary) {
      outlineRef.current = L.geoJSON(boundary, {
        pane: "fieldOutline",
        style: { className: "fieldmap-outline", color: "#FFFFFF", weight: 2.5, fillColor: "#9AA39C", fillOpacity: 0 },
      }).addTo(map);
      fit();
    } else {
      map.setView([1.3733, 32.2903], 6);
    }

    // Refit whenever the box changes size (first layout, window resize,
    // sidebar toggle), so no corner of the field is ever cut off.
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
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaryKey]);

  // ---- Show the picture --------------------------------------------------
  // A picture that is mostly see-through (everything masked as cloud, or a
  // bad response) would hide the field's health colour behind nothing, so
  // it is skipped and the plain health colour stays on the field instead.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const hide = () => {
      overlay.setOpacity(0);
      setPictureShown(false);
    };
    if (!showLayer || frame.isError) {
      hide();
      return;
    }
    const data = frame.data;
    if (!data) return;

    let cancelled = false;
    pictureCoverage(data.image).then((coverage) => {
      if (cancelled) return;
      if (coverage < MIN_PICTURE_COVERAGE) {
        console.warn(
          `field-frame picture for ${date} skipped: only ${Math.round(coverage * 100)}% of it has colour. ` +
            "Showing the overall health colour instead.",
        );
        hide();
        return;
      }
      overlay.setBounds(L.latLngBounds(data.bounds));
      overlay.setUrl(data.image);
      const reveal = () => {
        if (cancelled) return;
        overlay.setOpacity(NDVI_OPACITY);
        setPictureShown(true);
      };
      const img = overlay.getElement();
      if (img && !img.complete) img.addEventListener("load", reveal, { once: true });
      else reveal();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.data, frame.isError, showLayer, boundaryKey]);

  useEffect(() => {
    if (frame.isError) console.warn("field-frame failed:", (frame.error as Error).message);
  }, [frame.isError, frame.error]);

  // ---- Field colour and outline ------------------------------------------
  // The field is always coloured by the reading's overall health. When the
  // detailed picture is on screen the plain fill steps back so the
  // picture's own detail shows.
  useEffect(() => {
    const layer = outlineRef.current;
    if (!layer) return;
    layer.setStyle({
      color: isFlagged ? "#F0915F" : "#FFFFFF",
      weight: isFlagged ? 3.5 : 2.5,
      fillColor: ndvi !== null ? ndviColor(ndvi) : "#9AA39C",
      fillOpacity: !layerOn || ndvi === null ? 0 : pictureShown ? 0 : 0.55,
    });
    layer.eachLayer((l) => (l as L.Path).getElement?.()?.classList.toggle("fieldmap-flagged", isFlagged));
  }, [isFlagged, boundaryKey, ndvi, layerOn, pictureShown]);

  const loadingPicture = showLayer && frame.isFetching && !frame.data;

  return (
    <div className="relative h-full overflow-hidden rounded-xl bg-night-950 shadow-e1">
      <div ref={containerRef} className="absolute inset-0" aria-label="Satellite map of this field" role="img" />

      {latest && (
        <button
          onClick={() => setLayerOn((v) => !v)}
          aria-pressed={layerOn}
          className="absolute left-3 top-3 z-[500] flex h-11 items-center gap-2 rounded-full bg-canopy-950/70 pl-3 pr-4 text-sm font-medium text-white backdrop-blur-sm md:h-auto md:py-2 md:pl-2 md:pr-3 md:text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <span className={`relative h-4 w-7 rounded-full transition-colors ${layerOn ? "bg-growth-500" : "bg-white/30"}`}>
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${layerOn ? "left-3.5" : "left-0.5"}`}
            />
          </span>
          Crop health layer
        </button>
      )}

      {showLayer && date && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] w-44 rounded-lg bg-canopy-950/70 px-3 py-2 text-xs text-white/85 backdrop-blur-sm">
          <div className="h-1.5 rounded-full" style={{ background: NDVI_LEGEND_GRADIENT }} />
          <div className="mt-1 flex justify-between">
            <span>Poor</span>
            <span>Fair</span>
            <span>Very good</span>
          </div>
          <p className="mt-1 text-white/70">
            From {shortDay(date)}
            {isFlagged && <span className="text-[#F0915F]">. Drop flagged</span>}
          </p>
        </div>
      )}

      {!latest && (
        <p className="absolute inset-x-3 bottom-3 z-[500] rounded-lg bg-canopy-950/70 px-3 py-2 text-xs text-white/85 backdrop-blur-sm">
          No clear satellite photo yet. The field's health colour will show here once one arrives.
        </p>
      )}

      {loadingPicture && (
        <div className="absolute right-3 top-3 z-[500] flex items-center gap-2 rounded-full bg-canopy-950/70 px-3 py-2 text-xs text-white backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" />
          Loading picture
        </div>
      )}
    </div>
  );
}
