import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ESRI_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION = "Tiles &copy; Esri";

/**
 * Read-only satellite view of a field's saved boundary — no search, no
 * drawing tools. Just "here is the actual place this data is about,"
 * which the dashboard had no visual of before.
 */
export default function FieldPreviewMap({ boundary }: { boundary: GeoJSON.Polygon | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      dragging: true,
      scrollWheelZoom: false,
      attributionControl: false,
    });
    mapRef.current = map;
    L.tileLayer(ESRI_IMAGERY_URL, { attribution: ESRI_ATTRIBUTION, maxZoom: 19 }).addTo(map);

    if (boundary) {
      const layer = L.geoJSON(boundary, { style: { color: "#22A159", weight: 2, fillOpacity: 0.15 } }).addTo(map);
      map.fitBounds(layer.getBounds(), { padding: [16, 16] });
    } else {
      map.setView([1.3733, 32.2903], 6);
    }

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary]);

  return <div ref={containerRef} className="h-full w-full rounded-2xl" />;
}
