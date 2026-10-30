-- Run this once in the Supabase SQL Editor on your existing project.
--
-- Supports the small-field NDVI fix in supabase/functions/_shared/sentinel.ts:
-- when a field under 0.5 ha gets nothing usable from its exact drawn
-- boundary, the pipeline now retries against a small buffered square at
-- the field's centre. is_approximate marks those readings honestly, so
-- the app can tell the farmer "this is a nearby representative reading,
-- not an exact average of your field" instead of presenting it as
-- equally precise as a normal field's reading.

alter table public.satellite_images
  add column if not exists is_approximate boolean not null default false;

comment on column public.satellite_images.is_approximate is
  'True when this reading came from a small-field centroid fallback (a buffered square near the field''s centre) rather than the farmer''s own drawn boundary, because the exact polygon returned no usable Sentinel-2 pixels.';
