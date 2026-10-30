# Growell

A web app version of the "Web-Based System Using Satellite Imagery for
Automated Crop Health Monitoring and Anomaly Detection" project. Frontend
is React + Vite + TypeScript + Tailwind; backend is Supabase (Postgres +
Auth + Edge Functions). Rename the folder/package name if you land on a
different app name later — nothing here depends on "Growell" as a string.

## 1. Set up Supabase

1. Create a free project at supabase.com.
2. In the SQL editor, run `supabase/schema.sql` (creates all tables + row
   level security, so each farmer only ever sees their own data).
3. (Optional) Sign up one test user through the app first, then edit
   `supabase/seed.sql` with that user's id (Authentication → Users) and run
   it, to see the dashboard populated with 30 days of demo NDVI/weather data
   and one sample drought alert.
4. In Project Settings → API, copy your Project URL and anon public key.

## 2. Run the frontend locally

```bash
cp .env.example .env      # then paste your Supabase URL + anon key
npm install
npm run dev
```

Open http://localhost:5173, sign up, then click **+ Add** in the sidebar (or
the empty-state button) to add your first field: search for the area, trace
the boundary on the satellite map, and save. Once you've seeded a field's
imagery data too (step 3 below, or the seed script), you'll see the full
dashboard — NDVI trend chart, weather summary, and an alerts panel with
recommendations — matching Figure 7 in the design doc.

### The map / boundary-drawing stack (all free, no API keys)

- **Leaflet + leaflet-draw** for the map and polygon-drawing tool
- **Esri World Imagery** tiles for the satellite basemap (free for reasonable
  use, attribution included in the code — no account, no key)
- **OpenStreetMap Nominatim** for the location search box (free, no key;
  keep it to occasional manual searches — their usage policy caps automated
  requests at ~1/sec)
- **Turf.js** to compute the field's area in hectares from the drawn polygon

If you outgrow the free tiers later (e.g. want nicer basemap resolution),
Mapbox's satellite tiles are a drop-in replacement for the Esri URL in
`src/components/FieldBoundaryMap.tsx` — but you don't need that to get
started.

## 3. Deploy the Edge Functions

Two functions, both need the `SENTINELHUB_CLIENT_ID` / `SENTINELHUB_CLIENT_SECRET`
secrets from `supabase/SENTINEL_SETUP.md` (weather needs nothing — Open-Meteo
is free and keyless):

- **`daily-pipeline`** — the six-step pipeline from the System Design
  Document: fetch imagery → pre-process → detect anomaly → infer cause →
  recommend a solution → generate the alert. Looks at a short recent
  window (last 10 days) and runs full anomaly detection.
- **`backfill-field`** — called automatically right after a field is saved
  (see `AddField.tsx`). Pulls up to 90 days of historical NDVI + weather
  in one shot from Sentinel-2's existing archive, so a brand-new field's
  chart isn't empty. Deliberately doesn't generate alerts for backfilled
  days — alerts should mean "just detected," not backdated.

```bash
supabase functions deploy daily-pipeline --no-verify-jwt
supabase functions deploy backfill-field --no-verify-jwt
```

(`--no-verify-jwt`: `daily-pipeline` runs as a scheduled job with no user
session attached; `backfill-field` is called with your project's anon key
rather than a full user JWT. Both were confirmed necessary the first time
this was actually deployed — Supabase's newer JWT signing format rejects
the legacy anon-key format otherwise, with a clear `UNAUTHORIZED_LEGACY_JWT`
error if you forget the flag.)

Then in the Supabase dashboard, add a Cron trigger (Edge Functions →
daily-pipeline → Cron) so `daily-pipeline` runs once a day on its own.
**This has now been confirmed working against a live CDSE account** — a
real deployment successfully authenticated, called the Statistical API
against a real field boundary, and got back a real cloud-cover reading.
The one thing to watch: `CLOUD_COVER_LIMIT` in `daily-pipeline/index.ts`
defaults to 40% — genuinely cloudy weather will correctly skip a day
rather than save bad data, which is expected behavior, not a bug.

## 4. Host the web app

Any static host works since it's a Vite build (`npm run build` → `dist/`):
Vercel, Netlify, or Supabase's own static hosting all work with zero config.

## 5. Package it later, without a rewrite

This is a normal Vite + React app on purpose, because both routes below wrap
it as-is:

**Windows desktop — Tauri** (recommended: small installers, no Chromium
bundled, written in Rust but you don't need to touch Rust for a wrapper):
```bash
npm create tauri-app@latest    # point it at this existing frontend
npm run tauri build            # produces a .msi / .exe installer
```
Electron is the other common option if you'd rather stay in pure
JavaScript — heavier installer size, otherwise similar idea.

**Android — Capacitor** (from the Ionic team, actively maintained):
```bash
npm install @capacitor/core @capacitor/android
npx cap init growell com.yourname.growell
npm run build
npx cap add android
npx cap sync
npx cap open android   # opens Android Studio; build an .apk / .aab from there
```

Both routes point at the same `dist/` build output, so the web app, the
Windows app, and the Android app all stay in sync from one codebase.

## What's built vs. what's next

**Built:** auth (sign up/in/out), add-field flow (search + trace boundary +
save, with a satellite/streets toggle, geolocation, and an optional
planting date), a dashboard with a field mini-map, NDVI chart (anomaly
markers + baseline band), rainfall trend chart, a 5-day weather forecast
(Open-Meteo, called directly from the browser), a dry-spell counter, a
growth-stage card (day X of ~Y, based on crop type + planting date), and
an alerts panel with real confirm/correct farmer feedback. Full DB schema
+ RLS. Two Edge Functions — `daily-pipeline` (recent window, real anomaly
detection) and `backfill-field` (90-day historical pull) — both confirmed
working against a real, live CDSE account and a real Supabase project,
not just written-but-untested.

**Growth-stage-aware anomaly detection:** a crop's NDVI naturally declines
as it ripens toward harvest — without accounting for that, the pipeline
would flag a healthy, maturing crop as "possible drought stress" right
when the farmer least needs a false alarm. `_shared/cropStages.ts` (kept
in sync with `src/lib/cropStages.ts`) estimates days-to-maturity per crop
type; once a field is within its last ~15% of the expected season, a
detected drop is logged as `natural_senescence` (low severity, a
different message) instead of a generic drought/pest alert. Falls back to
the old behavior automatically for any field with no planting date set.

**Not built yet — natural next steps:**
- Edit/delete a field (there's now an inline way to *add* a planting date
  from the dashboard's Growth Stage card, but no full field-edit page yet)
- A real photo timelapse (would need Process API image fetches + storage,
  not just the NDVI number the Statistical API returns — the schema only
  stores a float per field per day right now)
- Mobile app packaging (Capacitor) and Windows packaging (Tauri) — the
  README steps above are accurate but untried
- The crop days-to-maturity figures in `cropStages.ts` are typical-variety
  estimates, not agronomic data for any specific region or variety —
  treat the growth-stage feature as a reasonable heuristic, not a precise
  model, and say so in any write-up

## Performance and caching

- **Shared cache (TanStack Query).** Profile, fields, alerts and field data are fetched once and shared.
  Data stays fresh for 2 minutes, then refreshes quietly in the background while the cached copy is shown.
- **Saved between visits.** The cache is saved in the browser (24 hours), so reopening the app shows the last
  data straight away on a slow connection. It is wiped on sign out and never shown to a different user.
- **Code splitting.** Each page, the chart library and the map library are separate downloads.
- **Skeletons.** Screens show grey placeholders in the real layout while data loads.
- **Adding a field** no longer waits for the 90-day history; it loads in the background.
