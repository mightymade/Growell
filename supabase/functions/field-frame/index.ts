// Returns one NDVI picture of a field for one date, for the crop health
// layer on the field map. The picture covers ONLY the field (everything outside the
// boundary is transparent) and is coloured from bare-soil brown to dense
// green, so the web app can lay it softly over the sharp map photo.
//
// Body: { field_id: string, date: "YYYY-MM-DD" }
// Reply: { image: "data:image/png;base64,...", bounds: [[south, west], [north, east]] }
//
// Only dates that already have a saved clear reading are allowed, and only
// for a field the signed-in farmer owns. Each picture is saved in the
// private "field-frames" Storage bucket the first time, so replaying the
// season again costs nothing from the Copernicus free quota.
//
// Deploy: supabase functions deploy field-frame --no-verify-jwt --use-api
// Needs:  supabase/patch_008_field_frames_bucket.sql run once.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAccessToken, SCL_ALWAYS_EXCLUDE, SCL_RELAXED_FOR_SMALL_FIELDS } from "../_shared/sentinel.ts";
import { MIN_RELIABLE_HECTARES } from "../_shared/fieldSize.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const BUCKET = "field-frames";
const LONG_SIDE_PX = 384;
const M_PER_DEG_LAT = 111_320;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// NDVI per pixel, coloured on a soft ramp.
// KEEP IN SYNC with src/lib/ndviColor.ts (the legend uses the same stops).
// Pixels outside the field, and the same pixels the crop health reading
// ignores (see fetchNdviTimeSeries in _shared/sentinel.ts), are
// transparent. The two MUST use the same list: when this picture also hid
// "cloud shadow" on a small field but the reading kept it, a field could
// have a reading and a completely empty picture. SCL is a class code, and
// smooth upsampling blends it at pixel edges, so it is rounded first.
const frameScript = (masked: number[]) => `
//VERSION=3
function setup() {
  return { input: ["B04", "B08", "SCL", "dataMask"], output: { bands: 4 } };
}
const ramp = new ColorRampVisualizer([
  [0.0, 0x8A6A4A],
  [0.2, 0xB89B5E],
  [0.35, 0xD4C45A],
  [0.5, 0x8CC152],
  [0.65, 0x3FA34D],
  [0.8, 0x1E7B3A],
]);
const MASKED = [${masked.join(", ")}];
function evaluatePixel(s) {
  const sum = s.B08 + s.B04;
  const ndvi = sum === 0 ? 0 : (s.B08 - s.B04) / sum;
  const masked = s.dataMask === 0 || MASKED.indexOf(Math.round(s.SCL)) !== -1;
  const c = ramp.process(ndvi);
  return [c[0], c[1], c[2], masked ? 0 : 1];
}
`;

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let fieldId: string, date: string;
  try {
    const body = await req.json();
    fieldId = String(body.field_id ?? "");
    date = String(body.date ?? "");
    if (!fieldId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error();
  } catch {
    return json({ error: "Expected JSON body: { field_id, date: YYYY-MM-DD }" }, 400);
  }

  // Read the field AS the signed-in farmer, so row level security decides
  // whether they may see it. Someone else's field id simply isn't found.
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: field } = await asUser.from("fields").select("id, boundary_coords, area_hectares").eq("id", fieldId).maybeSingle();
  if (!field?.boundary_coords) return json({ error: "Field not found" }, 404);

  const { data: reading } = await asUser
    .from("satellite_images")
    .select("capture_date")
    .eq("field_id", fieldId)
    .eq("capture_date", date)
    .maybeSingle();
  if (!reading) return json({ error: "No clear reading saved for that date" }, 404);

  // The picture covers the field's own bounding box. Pixels outside the
  // boundary come back transparent because the boundary is sent as the
  // request geometry.
  const ring = (field.boundary_coords as GeoJSON.Polygon).coordinates[0];
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const west = Math.min(...lons), east = Math.max(...lons);
  const south = Math.min(...lats), north = Math.max(...lats);
  const bounds = [[south, west], [north, east]];
  const widthM = (east - west) * M_PER_DEG_LAT * Math.cos((((south + north) / 2) * Math.PI) / 180);
  const heightM = (north - south) * M_PER_DEG_LAT;

  // Cached copy first.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // "v2": pictures saved before the masking fix may be blank, so they are
  // not reused.
  const path = `${fieldId}/ndvi-v2-${date}.png`;
  const cached = await admin.storage.from(BUCKET).download(path);
  if (cached.data) {
    const bytes = new Uint8Array(await cached.data.arrayBuffer());
    return json({ image: `data:image/png;base64,${toBase64(bytes)}`, bounds, cached: true });
  }

  const aspect = widthM / heightM;
  const width = aspect >= 1 ? LONG_SIDE_PX : Math.round(LONG_SIDE_PX * aspect);
  const height = aspect >= 1 ? Math.round(LONG_SIDE_PX / aspect) : LONG_SIDE_PX;

  let png: Uint8Array;
  try {
    const token = await getAccessToken();
    const res = await fetch("https://sh.dataspace.copernicus.eu/api/v1/process", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "image/png" },
      body: JSON.stringify({
        input: {
          bounds: {
            geometry: field.boundary_coords,
            properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
          },
          data: [
            {
              type: "sentinel-2-l2a",
              dataFilter: {
                timeRange: { from: `${date}T00:00:00Z`, to: `${date}T23:59:59Z` },
                mosaickingOrder: "leastCC",
              },
              // Smooth gradient instead of 10 m blocks. Bilinear, not
              // bicubic: bicubic overshoots and can invent greener or
              // browner spots than the data has.
              processing: { upsampling: "BILINEAR" },
            },
          ],
        },
        output: { width, height, responses: [{ identifier: "default", format: { type: "image/png" } }] },
        evalscript: frameScript(
          field.area_hectares != null && Number(field.area_hectares) < MIN_RELIABLE_HECTARES
            ? SCL_ALWAYS_EXCLUDE
            : [...SCL_ALWAYS_EXCLUDE, ...SCL_RELAXED_FOR_SMALL_FIELDS],
        ),
      }),
    });
    if (!res.ok) return json({ error: `Sentinel Hub image request failed (${res.status}): ${await res.text()}` }, 502);
    png = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }

  // Saving the cache copy is best effort. The picture is still returned.
  const up = await admin.storage.from(BUCKET).upload(path, png, { contentType: "image/png", upsert: true });
  return json({
    image: `data:image/png;base64,${toBase64(png)}`,
    bounds,
    cached: false,
    cache_error: up.error?.message ?? null,
  });
});
