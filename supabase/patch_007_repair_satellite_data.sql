-- Run this once in the Supabase SQL Editor. Safe to run more than once.
--
-- 1. Adds the is_approximate column. The browser console showed
--    "column satellite_images.is_approximate does not exist", which means
--    patch_006 was never run. Every NDVI save from the Edge Functions was
--    rejected because of it, so no satellite reading was ever stored.
alter table public.satellite_images
  add column if not exists is_approximate boolean not null default false;

-- 2. Removes any "NaN" readings saved by the old parser (a fully clouded
--    day could slip through as the text "NaN").
delete from public.satellite_images where ndvi_value = 'NaN';

-- 3. Check: how much each field has now. Run again after "Check now" or
--    after the daily job, and the counts should go up.
select f.field_name,
       f.area_hectares,
       (select count(*) from public.satellite_images s where s.field_id = f.id) as ndvi_rows,
       (select max(capture_date) from public.satellite_images s where s.field_id = f.id) as last_image,
       (select count(*) from public.weather_records w where w.field_id = f.id) as weather_rows
from public.fields f
order by f.field_name;
