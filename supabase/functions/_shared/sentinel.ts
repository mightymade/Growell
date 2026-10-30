// Shared Copernicus Data Space Ecosystem (Sentinel Hub) client — used by
// both daily-pipeline (recent data) and backfill-field (historical data),
// so both call the exact same, verified request shape instead of two
// copies that could quietly drift apart.
//
// Docs: https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html

import { MIN_RELIABLE_HECTARES } from "./fieldSize.ts";

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const clientId = Deno.env.get("SENTINELHUB_CLIENT_ID");
  const clientSecret = Deno.env.get("SENTINELHUB_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SENTINELHUB_CLIENT_ID / SENTINELHUB_CLIENT_SECRET secrets. " +
        "Register free at dataspace.copernicus.eu and create an OAuth client " +
        "under Account Settings, then `supabase secrets set` both values.",
    );
  }

  const res = await fetch(
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`CDSE token request failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

// Sentinel-2 L2A Scene Classification Layer values:
//  0 no_data               1 saturated_or_defective   2 dark_area_pixels
//  3 cloud_shadows         4 vegetation               5 bare_soils
//  6 water                 7 cloud_low_probability    8 cloud_medium_probability
//  9 cloud_high_probability 10 cirrus                 11 snow_ice
//
// Always excluded, any field size: genuinely unusable ground reflectance,
// not a judgment call.
export const SCL_ALWAYS_EXCLUDE = [0, 1, 8, 9, 10];

// Excluded too for a normal-sized field, where there's enough native
// 10m pixels that being strict costs little. For a field under
// MIN_RELIABLE_HECTARES, these three classes have a much higher
// false-positive rate on a small, mixed-surface plot — irrigation or wet
// soil misreads as "water", a nearby building's or tree's shadow misreads
// as "cloud shadow", and a genuinely low-confidence cloud call still gets
// treated as definite cloud. For a field with only one or two candidate
// native pixels to begin with, that's often the difference between one
// usable reading and none at all — so for a small field we accept the
// real risk of occasionally keeping a shadow- or haze-affected pixel, in
// exchange for getting a reading most of the time instead of never.
export const SCL_RELAXED_FOR_SMALL_FIELDS = [3, 6, 7];

export function buildEvalscript(badSclClasses: number[]): string {
  return `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "data", bands: 1 },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(samples) {
  let ndvi = (samples.B08 - samples.B04) / (samples.B08 + samples.B04);
  let validNdvi = (samples.B08 + samples.B04) === 0 ? 0 : 1;
  let badScl = [${badSclClasses.join(", ")}].indexOf(samples.SCL) !== -1 ? 1 : 0;
  return { data: [ndvi], dataMask: [samples.dataMask * validNdvi * (1 - badScl)] };
}
`;
}

export type NdviReading = { date: string; ndvi: number; cloudCoverPct: number };

/** One attempted date that did NOT produce a usable reading, and why —
 *  so a field stuck at zero readings is debuggable (check the Edge
 *  Function's logs / response body) instead of being a silent gap with
 *  no way to tell "fully masked out" apart from "genuinely no pass". */
export type SkippedDate = {
  date: string;
  reason: "no_samples" | "nan_mean" | "api_error";
  sampleCount: number;
  noDataCount: number;
};

export type NdviFetchResult = {
  readings: NdviReading[];
  skipped: SkippedDate[];
  /** True if this came from a small-field centroid fallback (a small
   *  buffered square at the field's centre) rather than the farmer's own
   *  drawn boundary — a representative nearby reading, not a true
   *  average across the exact polygon they traced. The frontend should
   *  say so rather than imply the same precision as a normal field. */
  approximate: boolean;
};

async function runStatisticalQuery(
  boundary: GeoJSON.Polygon,
  fromDate: Date,
  toDate: Date,
  badSclClasses: number[],
): Promise<{ readings: NdviReading[]; skipped: SkippedDate[] }> {
  const token = await getAccessToken();

  const body = {
    input: {
      bounds: {
        geometry: boundary,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        { type: "sentinel-2-l2a", dataFilter: { mosaickingOrder: "leastCC", maxCloudCoverage: 80 } },
      ],
    },
    aggregation: {
      timeRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
      aggregationInterval: { of: "P1D" },
      evalscript: buildEvalscript(badSclClasses),
      // Fixed small pixel grid rather than resx/resy in meters — sidesteps
      // needing a per-field UTM zone just to express resolution. For a
      // smallholder field this also oversamples (interpolates) well below
      // Sentinel-2's native 10m, which helps a tiny or thin polygon align
      // with the sample grid — it doesn't invent real ground detail, but
      // it does reduce "the polygon fell between pixel centres" misses.
      size: [64, 64],
    },
  };

  const res = await fetch("https://sh.dataspace.copernicus.eu/statistics/v1", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Sentinel Hub Statistical API failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  return parseStatisticalResponse(json);
}

/**
 * Pulled out of runStatisticalQuery as a pure function (no fetch, no
 * Deno.env) specifically so it has a real unit test — this is the part
 * that decides whether a given day's pass becomes a stored reading or a
 * silent gap, so it's the part most worth being sure about.
 */
export function parseStatisticalResponse(json: { data?: unknown[] }): { readings: NdviReading[]; skipped: SkippedDate[] } {
  const readings: NdviReading[] = [];
  const skipped: SkippedDate[] = [];
  for (const interval of (json.data ?? []) as any[]) {
    const date = String(interval?.interval?.from ?? "").slice(0, 10);
    if (!date) continue;

    // The API can fail one day and still answer the others. That day has
    // an "error" object and no outputs.
    if (interval?.error) {
      skipped.push({ date, reason: "api_error", sampleCount: 0, noDataCount: 0 });
      continue;
    }

    const stats = interval?.outputs?.data?.bands?.B0?.stats;
    // sampleCount is ALL pixels inside the boundary. noDataCount is the
    // part of those that was masked out (cloud, no data). So the usable
    // pixels are sampleCount - noDataCount, not sampleCount.
    const sampleCount = Number(stats?.sampleCount ?? 0);
    const noDataCount = Number(stats?.noDataCount ?? 0);
    const validCount = sampleCount - noDataCount;
    if (!stats || sampleCount === 0 || validCount <= 0) {
      skipped.push({ date, reason: "no_samples", sampleCount, noDataCount });
      continue;
    }

    // JSON has no NaN, so the API sends the text "NaN". Number.isNaN("NaN")
    // is false, so the old check let that text through as a reading.
    const mean = Number(stats.mean);
    if (!Number.isFinite(mean)) {
      skipped.push({ date, reason: "nan_mean", sampleCount, noDataCount });
      continue;
    }

    const cloudCoverPct = (noDataCount / sampleCount) * 100;
    readings.push({ date, ndvi: mean, cloudCoverPct });
  }
  return { readings, skipped };
}

/** A small square polygon centred on a point, sized in metres. Used as
 *  the small-field fallback AOI — a buffered area around the centroid
 *  instead of the farmer's exact (possibly far smaller than one native
 *  pixel) drawn boundary. Longitude degrees shrink with latitude, so the
 *  east-west half-width is corrected by cos(latitude); the north-south
 *  half-height isn't, since a degree of latitude is ~constant everywhere. */
export function squareAroundPoint(lat: number, lon: number, halfSideMeters: number): GeoJSON.Polygon {
  const METERS_PER_DEGREE_LAT = 111_320;
  const dLat = halfSideMeters / METERS_PER_DEGREE_LAT;
  const dLon = halfSideMeters / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
  return {
    type: "Polygon",
    coordinates: [
      [
        [lon - dLon, lat - dLat],
        [lon + dLon, lat - dLat],
        [lon + dLon, lat + dLat],
        [lon - dLon, lat + dLat],
        [lon - dLon, lat - dLat],
      ],
    ],
  };
}

// 3x3 native 10m pixels' worth of side length — enough margin that the
// fallback query isn't itself vulnerable to the same "smaller than one
// pixel" problem it exists to work around.
const FALLBACK_HALF_SIDE_METERS = 15;

/**
 * Fetches one NDVI + cloud-cover reading per day (where a usable
 * Sentinel-2 pass exists) for a field's boundary, over the given date
 * range — used for both the daily-pipeline's short lookback and
 * backfill-field's multi-month historical pull.
 *
 * `areaHectares` is optional context, not a hard requirement: when given
 * and under MIN_RELIABLE_HECTARES (see supabase/functions/_shared/fieldSize.ts),
 * masking is relaxed for known small-field false-positive classes, and if
 * the farmer's exact drawn polygon still comes back with nothing at all,
 * this retries once against a small buffered square at the field's
 * centroid before giving up.
 */
export async function fetchNdviTimeSeries(
  boundary: GeoJSON.Polygon,
  fromDate: Date,
  toDate: Date,
  areaHectares?: number | null,
): Promise<NdviFetchResult> {
  const isSmallField = areaHectares != null && areaHectares < MIN_RELIABLE_HECTARES;
  const mask = isSmallField ? SCL_ALWAYS_EXCLUDE : [...SCL_ALWAYS_EXCLUDE, ...SCL_RELAXED_FOR_SMALL_FIELDS];

  const primary = await runStatisticalQuery(boundary, fromDate, toDate, mask);
  if (primary.readings.length > 0 || !isSmallField) {
    return { ...primary, approximate: false };
  }

  // Small field, relaxed masking, and the exact drawn polygon still
  // produced nothing usable across the whole window — fall back to a
  // buffered point at its centre rather than reporting total silence.
  const { lat, lon } = polygonCentroid(boundary);
  const fallbackBoundary = squareAroundPoint(lat, lon, FALLBACK_HALF_SIDE_METERS);
  const fallback = await runStatisticalQuery(fallbackBoundary, fromDate, toDate, mask);
  return {
    readings: fallback.readings,
    skipped: [...primary.skipped, ...fallback.skipped],
    approximate: fallback.readings.length > 0,
  };
}

export function polygonCentroid(polygon: GeoJSON.Polygon): { lat: number; lon: number } {
  const ring = polygon.coordinates[0]; // exterior ring, [lon, lat] pairs, last point repeats the first
  const points = ring.slice(0, -1);
  const lon = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const lat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return { lat, lon };
}
