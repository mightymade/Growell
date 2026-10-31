<div align="center">

<img src="public/logo.svg" alt="Growell logo" width="72" />

# Growell

**Crop health monitoring from space, with automatic alerts for farmers.**

Growell uses free Sentinel-2 satellite imagery to track the health of each field a farmer draws on a map. It checks every field daily, compares new readings with the field's own recent history, and sends a plain-language alert with a likely cause and a suggested action when crop health drops.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres_%7C_Auth_%7C_Edge_Functions-3FCF8E?logo=supabase&logoColor=white)

</div>

---

## About

Growell is the final-year project **"A Web-Based System Using Satellite Imagery for Automated Crop Health Monitoring and Anomaly Detection"** by Made Humphrey at Uganda Christian University.

Many smallholder farmers only notice crop stress once it is visible on the ground, when it is often too late to act cheaply. Satellites see stress earlier, through changes in how plants reflect light. Growell turns that satellite data into something a farmer can read at a glance: a health word (Poor, Fair, Good, Very good), a season timelapse of the field, and an alert when something changes.

## Features

**Fields**
- Draw a field's boundary on a satellite map and save it with its crop type and planting date
- Area in hectares is worked out automatically from the drawn shape
- 90 days of satellite and weather history load as soon as a field is saved, so charts are never empty

**Crop health**
- NDVI (Normalised Difference Vegetation Index) from Sentinel-2, clipped to the field boundary, with clouds and shadows masked out
- Season timelapse: the field's crop health shown as a colour layer on the map, with a play button and a slider to move through the season
- Crop health chart over time with Poor, Fair, Good and Very good bands
- Weekly rainfall chart, latest weather, and a 5-day forecast
- Growth stage tracking from the planting date

**Alerts**
- A daily server job checks every field, whether or not anyone logs in
- An alert is raised when crop health falls more than 15% below the field's recent average
- Each alert names a likely cause (dry spell, too much rain, or possible pests or disease) and a suggested action
- In-app notification bell, live pop-up alerts, and an Alerts page where farmers confirm whether an alert was accurate
- Each field is also checked for new images once per login, with automatic retries

**Accounts and app**
- Email sign-up and login with email confirmation and password reset
- Profile photo, account deactivation, and automatic sign-out after 20 minutes of inactivity
- Light and dark mode, a layout that works on phones, tablets and computers, and support for keyboard and screen readers
- Data is cached in the browser, so the last loaded view still shows when the connection drops

## How it works

```
 Sentinel-2 imagery  ─┐
 (Copernicus)         ├─►  Edge Functions  ─►  Postgres  ─►  React app
 Open-Meteo weather  ─┘    (Supabase)         (Supabase)      (browser)
```

The daily pipeline (`supabase/functions/daily-pipeline`) runs six steps for every field:

1. **Data ingestion.** Fetch the newest Sentinel-2 pass and recent weather for the field.
2. **Pre-processing.** Mask clouds and shadows using the scene classification layer, and skip images that are more than 40% cloud.
3. **Anomaly detection.** Compare the new NDVI reading with the average of the field's last 30 readings. A drop of more than 15% is an anomaly.
4. **Cause inference.** Use recent rainfall to suggest a likely cause: under 3 mm points to a dry spell, over 12 mm to waterlogging, anything in between to possible pests or disease.
5. **Recommendation.** Pick a practical next step for that cause.
6. **Alert generation.** Save the alert, which reaches the farmer's browser in real time.

Two more functions support the app:
- **`backfill-field`** loads 90 days of history for a new field, and is also used for the once-per-login check. It never creates alerts for past dates.
- **`field-frame`** builds the cloud-free crop health picture of a field for each date in the season timelapse, and caches it in storage.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Data and caching | TanStack Query with a browser-stored cache |
| Maps | Leaflet, React Leaflet, Leaflet-Geoman (boundary drawing), Turf.js (area) |
| Charts | Recharts |
| Backend | Supabase: Postgres with row level security, Auth, Storage, Realtime, Edge Functions (Deno) |
| Satellite data | Copernicus Data Space Ecosystem, Sentinel Hub Statistical and Process APIs |
| Weather | Open-Meteo (free, no key needed) |
| Basemap and search | Esri World Imagery tiles, OpenStreetMap Nominatim |
| Hosting | Vercel |

## Project structure

```
growell/
├── public/                  Logo, images and crop photos
├── src/
│   ├── pages/               Landing, Login, Signup, Home, FieldDetail, AddField, AlertsPage, Account
│   ├── components/          Layout, sidebar, charts, map timelapse, alerts, dialogs, form controls
│   ├── hooks/               Data loading, live alerts, theme, idle sign-out, online status
│   └── lib/                 Supabase client, API calls, NDVI colours, crop stages, helpers
├── supabase/
│   ├── schema.sql           Tables, row level security and functions
│   ├── patch_001 … 009.sql  Database updates, run in order after schema.sql
│   ├── seed.sql             Optional demo data
│   ├── email-templates/     Sign-up and password reset emails
│   ├── SENTINEL_SETUP.md    How to get the satellite data keys
│   └── functions/           daily-pipeline, backfill-field, field-frame, and shared code
└── vercel.json              Hosting settings
```

## Getting started

### What you need

- Node.js 18 or newer
- A free [Supabase](https://supabase.com) project
- A free [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu) account for satellite data (see `supabase/SENTINEL_SETUP.md`)

### 1. Set up the database

In the Supabase SQL Editor, run these files in this order:

1. `supabase/schema.sql`
2. `supabase/patch_001_anomaly_update_policy.sql` through `supabase/patch_009_alert_system.sql`, one at a time, in number order

### 2. Add the satellite keys

In Supabase, go to **Edge Functions**, then **Secrets**, and add:

| Name | Where to get it |
|---|---|
| `SENTINELHUB_CLIENT_ID` | Copernicus dashboard, OAuth clients |
| `SENTINELHUB_CLIENT_SECRET` | Copernicus dashboard, OAuth clients |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to Edge Functions by Supabase automatically.

### 3. Deploy the Edge Functions

From the `growell` folder:

```bash
npx supabase login
npx supabase functions deploy daily-pipeline --no-verify-jwt --project-ref YOUR_PROJECT_REF
npx supabase functions deploy backfill-field --no-verify-jwt --project-ref YOUR_PROJECT_REF
npx supabase functions deploy field-frame --no-verify-jwt --project-ref YOUR_PROJECT_REF
```

Then schedule `daily-pipeline` to run once a day (for example `0 3 * * *`, which is 06:00 in Uganda) from the Supabase dashboard. Without this schedule, fields are only checked when someone logs in.

### 4. Run the app locally

```bash
cp .env.example .env
npm install
npm run dev
```

Fill in `.env` with your Supabase details from **Project Settings**, then **API**:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Open http://localhost:5173, create an account, and add your first field.

## Deployment

The app is a static Vite build hosted on Vercel, which rebuilds the site on every push to `main`.

1. Import the repository in Vercel. Build settings come from `vercel.json`.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables.
3. In Supabase, under **Authentication**, then **URL Configuration**, set the Site URL to the live address and add `https://YOUR-SITE.vercel.app/**` to the Redirect URLs, so confirmation and password reset emails link to the live site.

The anon key is meant to be public. Row level security makes sure each farmer can only read and change their own data. The service role key is only used inside Edge Functions and must never be added to the website or to the repository.

## Limitations

- **Image resolution.** Sentinel-2 pixels are 10 m by 10 m. Fields under 0.5 hectares cover only a few pixels, so their readings are marked as rough and nearby land can affect them.
- **Clouds.** Images that are mostly cloud are skipped, so in the rainy season there can be gaps of a week or more between readings.
- **Cause inference is rule-based.** Likely causes come from rainfall alone. They are a starting point for the farmer to check in the field, not a diagnosis.
- **Satellite revisit.** Sentinel-2 passes over a location every 2 to 5 days, so Growell cannot be more current than the latest pass.

## Data sources and credits

- Satellite imagery: contains modified Copernicus Sentinel data, processed through the Copernicus Data Space Ecosystem
- Weather: [Open-Meteo](https://open-meteo.com)
- Basemap: Esri World Imagery
- Place search: [OpenStreetMap](https://www.openstreetmap.org/copyright) Nominatim

## Author

**Made Humphrey**
Uganda Christian University

Final-year project. All rights reserved.
