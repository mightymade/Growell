# Getting real Sentinel-2 data working

The pipeline in `functions/daily-pipeline/index.ts` calls the real
Copernicus Data Space Ecosystem (CDSE) Statistical API for NDVI, and
Open-Meteo for weather. Weather needs nothing from you — it's free and
keyless. Satellite data needs a one-time setup:

## 1. Register (free, ~2 minutes)

Go to **dataspace.copernicus.eu**, click Register, create an account.
No payment details, no approval wait.

## 2. Create an OAuth client

1. Log in, go to your **Account Settings** (shapps.dataspace.copernicus.eu/dashboard/#/account/settings)
2. Find **OAuth clients** → **Create**
3. Give it any name (e.g. "growell-pipeline")
4. Pick an expiry, or "Never expire" (you'll need to confirm you understand
   the risk if so — fine for a project like this)
5. Leave the "single-page application" option unchecked — this is called
   from a server-side Edge Function, not a browser
6. Click Create. **Copy the Client ID and Client Secret immediately** —
   the secret is shown once and can't be retrieved again after you close
   the popup.

## 3. Add them as Supabase secrets

```bash
supabase secrets set SENTINELHUB_CLIENT_ID=your-client-id
supabase secrets set SENTINELHUB_CLIENT_SECRET=your-client-secret
```

Or via the dashboard: Project Settings → Edge Functions → Secrets.

## 4. Deploy and test

```bash
supabase functions deploy daily-pipeline
```

Then trigger it manually once (dashboard → Edge Functions → daily-pipeline
→ Invoke, or `curl` it with your anon key) and check the response JSON —
each field will report either an NDVI reading, "skipped (too cloudy)," or
an error message telling you exactly what went wrong.

## What to expect on a first run

- **No fields with saved boundaries yet** → nothing to process, empty result.
- **A field with no Sentinel-2 pass in the last 10 days** → that field's
  entry says so explicitly, rather than silently failing.
- **Wrong or expired credentials** → the error names the missing/invalid
  secret directly; nothing is faked to paper over it.

## Free tier limits, so you're not surprised later

CDSE's free tier includes a monthly quota of "processing units." A single
Statistical API call like this one (small polygon, 64×64 sample grid, one
day) costs a small fraction of a processing unit — a handful of fields
checked once a day is nowhere near the free limit. If you scale this up
to hundreds of fields or run it many times a day, check your usage under
Account Settings → the free tier could need topping up at that point, but
that's a "later problem," not a "getting started" problem.
