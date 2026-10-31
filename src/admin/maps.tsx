import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FieldRow } from "./api";
import { ndviColor, healthWord, NDVI_LEGEND_GRADIENT } from "../lib/ndviColor";
import { hectares } from "./format";

const ESRI_IMAGERY_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const UGANDA: L.LatLngTuple = [1.3733, 32.2903];
const NO_READING = "#9AA39C";

function Legend({ note }: { note?: string }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[500] w-44 rounded-lg bg-canopy-950/75 px-3 py-2 text-xs text-white/85 backdrop-blur-sm">
      <div className="h-1.5 rounded-full" style={{ background: NDVI_LEGEND_GRADIENT }} />
      <div className="mt-1 flex justify-between">
        <span>Poor</span>
        <span>Fair</span>
        <span>Very good</span>
      </div>
      {note && <p className="mt-1 text-white/70">{note}</p>}
    </div>
  );
}

/**
 * Every field as a dot at its centre on the satellite photo, coloured by its
 * latest crop health. Clicking a dot shows who owns it and a link to it.
 */
export function FieldsMap({ fields, onOpen }: { fields: FieldRow[]; onOpen: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { zoomControl: true, attributionControl: false, scrollWheelZoom: true, maxZoom: 18 });
    L.tileLayer(ESRI_IMAGERY_URL, { maxZoom: 18 }).addTo(map);

    const points = fields.filter((f) => f.centroid);
    const bounds: L.LatLngTuple[] = [];
    for (const f of points) {
      const ll: L.LatLngTuple = [f.centroid!.lat, f.centroid!.lng];
      bounds.push(ll);
      const marker = L.circleMarker(ll, {
        radius: 8,
        color: "#FFFFFF",
        weight: 2,
        fillColor: f.latest_ndvi === null ? NO_READING : ndviColor(Number(f.latest_ndvi)),
        fillOpacity: 1,
      }).addTo(map);

      // Built as real elements, never from strings, so names can't inject HTML.
      const box = document.createElement("div");
      box.className = "min-w-[180px] text-sm";
      const title = document.createElement("p");
      title.className = "font-semibold text-ink";
      title.textContent = f.name;
      const meta = document.createElement("p");
      meta.className = "mt-1 text-ink/70";
      meta.textContent = `${f.owner_name}. ${[f.crop, f.area_ha !== null ? hectares(f.area_ha) : null].filter(Boolean).join(", ")}`;
      const health = document.createElement("p");
      health.className = "mt-1 text-ink/70";
      health.textContent = `Crop health: ${f.latest_ndvi === null ? "no reading yet" : healthWord(Number(f.latest_ndvi))}`;
      const open = document.createElement("button");
      open.type = "button";
      open.className = "mt-2 h-9 w-full rounded-lg bg-growth-600 px-3 text-sm font-semibold text-white hover:bg-growth-700";
      open.textContent = "Open field";
      open.addEventListener("click", () => onOpenRef.current(f.id));
      box.append(title, meta, health, open);
      marker.bindPopup(box, { closeButton: true });
      marker.bindTooltip(f.name, { direction: "top", offset: [0, -8] });
    }

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    else map.setView(UGANDA, 7);

    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      map.remove();
    };
  }, [fields]);

  const missing = fields.filter((f) => !f.centroid).length;
  return (
    <div className="relative h-full overflow-hidden rounded-xl bg-night-950">
      <div ref={el} className="absolute inset-0" role="img" aria-label={`Map of ${fields.length} fields, coloured by crop health`} />
      <Legend note={missing > 0 ? `${missing} without an outline are not shown` : "Grey: no reading yet"} />
    </div>
  );
}

/** One field's outline on the satellite photo, filled with its health colour. */
export function OutlineMap({ boundary, ndvi, deleted }: { boundary: GeoJSON.Polygon | null; ndvi: number | null; deleted: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const key = boundary ? JSON.stringify(boundary.coordinates) : "";

  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { zoomControl: true, attributionControl: false, scrollWheelZoom: false, maxZoom: 19 });
    L.tileLayer(ESRI_IMAGERY_URL, { maxZoom: 19 }).addTo(map);
    if (boundary) {
      const layer = L.geoJSON(boundary as GeoJSON.Polygon, {
        style: {
          color: deleted ? "#F2A982" : "#FFFFFF",
          weight: 2.5,
          dashArray: deleted ? "6 6" : undefined,
          fillColor: ndvi === null ? NO_READING : ndviColor(ndvi),
          fillOpacity: 0.45,
        },
      }).addTo(map);
      map.fitBounds(layer.getBounds(), { padding: [32, 32], maxZoom: 18 });
    } else {
      map.setView(UGANDA, 7);
    }
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ndvi, deleted]);

  return (
    <div className="relative h-full overflow-hidden rounded-xl bg-night-950">
      <div ref={el} className="absolute inset-0" role="img" aria-label="Satellite map with the field's outline" />
      <Legend note={deleted ? "Dashed outline: deleted field" : "Fill: latest crop health"} />
    </div>
  );
}
