import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import area from "@turf/area";
import { polygon as turfPolygon } from "@turf/helpers";

// Leaflet's default marker icons reference image files by a path that
// Vite's bundler breaks; point them at the CDN copies instead. This only
// affects marker pins (not the polygon drawing tool), but without it you
// get a console error and a broken-image icon if you ever add markers.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Free satellite basemap — Esri World Imagery. No API key, no billing
// account. Attribution is required and included below per their terms.
const ESRI_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

// Esri's free companion "reference" layer — place names, roads, and
// administrative boundaries, drawn transparently on top of the imagery
// above. This is what turns plain satellite photos into the "Hybrid"
// look Google Maps shows by default (photography + labels), and it's
// the same free tier as the imagery layer — no separate key needed.
const ESRI_LABELS_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

// OpenStreetMap's standard street map — free, no API key. Esri's free
// reference layer above only carries major roads and named places; OSM
// is community-mapped and, specifically in rural Uganda, has had real
// attention from humanitarian mapping projects (HOT / YouthMappers)
// aimed at exactly the small farm roads and footpaths that commercial
// map data tends to skip. Offered as a toggle rather than replacing
// satellite outright, since tracing a field boundary still needs real
// imagery underneath, not a street map.
const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = "&copy; OpenStreetMap contributors";

export type BoundaryResult = {
  geojson: GeoJSON.Polygon;
  areaHectares: number;
};

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
};

type Props = {
  center?: [number, number]; // [lat, lng]
  zoom?: number;
  onBoundaryChange: (result: BoundaryResult | null) => void;
  /** Extra classes on the outer wrapper — pass "h-full" to let the map
   *  fill whatever height its parent gives it (used for the desktop
   *  side-by-side layout). Defaults to a fixed height for simple uses. */
  className?: string;
};

/**
 * Satellite map with a polygon-drawing tool for tracing a field boundary,
 * plus a free-text location search (OpenStreetMap Nominatim, no API key)
 * to jump the map to the right area first.
 *
 * Uses Leaflet-Geoman (not leaflet-draw) for the polygon tool. leaflet-draw
 * has a known, unfixed "type is not defined" crash with Leaflet 1.9+ that
 * cuts a polygon off partway through drawing — Geoman is the actively
 * maintained replacement and has no vertex-count limit.
 */
export default function FieldBoundaryMap({
  center = [1.3733, 32.2903],
  zoom = 6,
  onBoundaryChange,
  className = "",
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnLayerRef = useRef<L.Layer | null>(null);
  const locationMarkerRef = useRef<L.LayerGroup | null>(null);
  const satelliteLayerRef = useRef<L.LayerGroup | null>(null);
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const [mapView, setMapView] = useState<"satellite" | "street">("satellite");
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function showLocationMarker(lat: number, lng: number, accuracyMeters: number) {
    if (!mapRef.current) return;
    locationMarkerRef.current?.remove();
    const group = L.layerGroup([
      // Accuracy radius — how confident the browser is, same idea as
      // Google Maps' blue "you are here" circle.
      L.circle([lat, lng], {
        radius: accuracyMeters,
        color: "#3C6E8F",
        fillColor: "#3C6E8F",
        fillOpacity: 0.12,
        weight: 1,
      }),
      L.circleMarker([lat, lng], {
        radius: 7,
        color: "#fff",
        weight: 2,
        fillColor: "#3C6E8F",
        fillOpacity: 1,
      }),
    ]).addTo(mapRef.current);
    locationMarkerRef.current = group;
  }

  /** `manual` is true when the farmer tapped "My location". The automatic
   *  attempt when the map opens fails quietly; help only appears when they
   *  asked for their location themselves. */
  function locateUser(manual = false) {
    if (!mapRef.current) return;
    if (!("geolocation" in navigator)) {
      if (manual) setLocationError("This browser can't share your location. Search for your area instead.");
      return;
    }
    setLocating(true);
    setLocationError(null);

    const onSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      mapRef.current?.setView([latitude, longitude], 17);
      showLocationMarker(latitude, longitude, accuracy);
      setLocating(false);
    };

    const onFinalError = (err: GeolocationPositionError) => {
      setLocating(false);
      if (!manual) return;
      setLocationError(
        err.code === err.PERMISSION_DENIED
          ? "Location is turned off for this site. Tap the padlock next to the web address, allow Location, then try again. Or search for your area."
          : "Couldn't find your location. This often happens on a computer. Search for your area instead.",
      );
    };

    // Try for a precise (GPS-level) fix first. Desktops without GPS
    // hardware often time out on this, so fall back automatically to a
    // faster, coarser network-based fix instead of just failing outright.
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          onFinalError(err);
          return;
        }
        navigator.geolocation.getCurrentPosition(onSuccess, onFinalError, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000,
        });
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function toggleMapView() {
    if (!mapRef.current || !satelliteLayerRef.current || !streetLayerRef.current) return;
    if (mapView === "satellite") {
      mapRef.current.removeLayer(satelliteLayerRef.current);
      mapRef.current.addLayer(streetLayerRef.current);
      setMapView("street");
    } else {
      mapRef.current.removeLayer(streetLayerRef.current);
      mapRef.current.addLayer(satelliteLayerRef.current);
      setMapView("satellite");
    }
  }

  // Set up the map once, then try to jump straight to the farmer's actual
  // location — a country-wide default view is "some random place on the
  // map" to them, not somewhere they can immediately recognize their farm.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView(center, zoom);
    mapRef.current = map;

    const satelliteLayer = L.layerGroup([
      L.tileLayer(ESRI_IMAGERY_URL, { attribution: ESRI_ATTRIBUTION, maxZoom: 19 }),
      L.tileLayer(ESRI_LABELS_URL, { maxZoom: 19, opacity: 0.9 }),
    ]);
    const streetLayer = L.tileLayer(OSM_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 19 });
    satelliteLayerRef.current = satelliteLayer;
    streetLayerRef.current = streetLayer;
    satelliteLayer.addTo(map); // satellite is the default — needed to actually trace a boundary

    // Geoman's drawing toolbar. No vertex limit — a field boundary can be
    // any shape, unlike leaflet-draw which crashed partway through.
    (map as any).pm.addControls({
      position: "topleft",
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawText: false,
      drawPolygon: true,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
      rotateMode: false,
    });
    (map as any).pm.setPathOptions({ color: "#15884A", fillColor: "#15884A", fillOpacity: 0.15 });

    function emitBoundary(layer: any) {
      const geojson = layer.toGeoJSON().geometry as GeoJSON.Polygon;
      const areaM2 = area(turfPolygon(geojson.coordinates));
      onBoundaryChange({ geojson, areaHectares: Math.round((areaM2 / 10000) * 100) / 100 });
    }

    map.on("pm:create" as any, (e: any) => {
      // Only one field boundary at a time: remove any previous shape.
      if (drawnLayerRef.current && drawnLayerRef.current !== e.layer) {
        map.removeLayer(drawnLayerRef.current);
      }
      drawnLayerRef.current = e.layer;
      emitBoundary(e.layer);
      e.layer.on("pm:edit", () => emitBoundary(e.layer));
      e.layer.on("pm:markerdragend", () => emitBoundary(e.layer));
      e.layer.on("pm:vertexadded", () => emitBoundary(e.layer));
      e.layer.on("pm:vertexremoved", () => emitBoundary(e.layer));
    });

    map.on("pm:remove" as any, (e: any) => {
      if (e.layer === drawnLayerRef.current) {
        drawnLayerRef.current = null;
        onBoundaryChange(null);
      }
    });

    // Jump to the farmer's real location as soon as the map is ready,
    // instead of leaving them on the zoomed-out country-wide default.
    locateUser();

    // The map's container can resize after this point (e.g. the desktop
    // two-pane layout finalizing its flex sizes just after mount, or the
    // window itself resizing) — Leaflet needs to be told explicitly when
    // that happens, or it keeps rendering at its original size.
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(mapContainerRef.current);
    const raf = requestAnimationFrame(() => map.invalidateSize());

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(raf);
      map.off();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchText.trim() || !mapRef.current) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      // Nominatim's free geocoding API — no key required. limit=5 so we
      // can show candidates instead of blindly jumping to its single best
      // (and sometimes wrong) guess — it's much more reliable for towns
      // and villages than for specific institution/building names.
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(searchText)}`,
      );
      const results: SearchResult[] = await res.json();
      if (results.length === 0) {
        setSearchError("Location not found. Try a nearby town, village, or district name instead.");
        return;
      }
      if (results.length === 1) {
        flyTo(results[0]);
      } else {
        setSearchResults(results);
      }
    } catch {
      setSearchError("Search failed. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  }

  function flyTo(result: SearchResult) {
    mapRef.current?.setView([parseFloat(result.lat), parseFloat(result.lon)], 16);
    setSearchResults([]);
  }

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-canopy-900/10 dark:border-white/10 bg-white dark:bg-night-900 ${className}`}>
      <div className="relative shrink-0 border-b border-canopy-900/10 dark:border-white/10 bg-white dark:bg-night-900 p-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search for a town, district, or place name…"
            className="flex-1 rounded-lg border border-canopy-900/15 dark:border-white/15 px-3 py-2 text-base focus:border-growth-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded-lg bg-growth-600 px-3 py-2 text-sm font-medium text-white hover:bg-growth-600/90 disabled:opacity-50"
          >
            {searching ? "Searching…" : "Search"}
          </button>
          <button
            type="button"
            onClick={() => locateUser(true)}
            disabled={locating}
            title="Use my location"
            className="flex items-center gap-2 rounded-lg border border-canopy-900/15 dark:border-white/15 px-3 py-2 text-sm font-medium text-ink dark:text-parchment hover:bg-parchment dark:hover:bg-white/5 disabled:opacity-50"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="2" fill="currentColor" />
              <path
                d="M7.5 1v2M7.5 12v2M1 7.5h2M12 7.5h2"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <span className="hidden sm:inline">{locating ? "Locating…" : "My location"}</span>
          </button>
        </form>

        {/* Candidate results — lets the farmer pick the right match instead
            of the app silently guessing (and sometimes guessing wrong). */}
        {searchResults.length > 0 && (
          <ul className="absolute left-3 right-3 top-full z-[1000] mt-1 max-h-56 overflow-y-auto rounded-lg border border-canopy-900/10 dark:border-white/10 bg-white dark:bg-night-900 shadow-e2">
            {searchResults.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => flyTo(r)}
                  className="w-full border-b border-canopy-900/5 dark:border-white/5 px-3 py-2 text-left text-sm text-ink/80 dark:text-parchment/80 last:border-0 hover:bg-growth-50"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {searchError && <p className="shrink-0 bg-sky-100 px-3 py-2 text-xs text-sky-700">{searchError}</p>}
      {locationError && <p className="shrink-0 bg-sky-100 px-3 py-2 text-xs text-sky-700">{locationError}</p>}
      {locating && <p className="shrink-0 bg-sky-100 px-3 py-2 text-xs text-sky-700">Finding your location…</p>}

      <div className="relative min-h-0 flex-1">
        <div ref={mapContainerRef} className="h-full w-full" />
        <button
          type="button"
          onClick={toggleMapView}
          className="absolute right-3 top-3 z-[1000] rounded-lg bg-white dark:bg-night-900 px-3 py-2 text-xs font-semibold text-ink dark:text-parchment shadow-e2 hover:bg-parchment dark:hover:bg-white/5"
        >
          {mapView === "satellite" ? "🗺️ Streets" : "🛰️ Satellite"}
        </button>
      </div>

      <p className="shrink-0 border-t border-canopy-900/10 dark:border-white/10 bg-parchment dark:bg-night-950 px-3 py-2 text-xs text-ink/70 dark:text-parchment/70">
        Tap the shape tool at the top left of the map, then tap each corner of your field. Tap the first corner
        again to close the shape. You can move corners or delete the shape and start again before saving.
      </p>
    </div>
  );
}
