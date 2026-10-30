-- Run once in the Supabase SQL Editor. Safe to run more than once.
-- Private bucket where the field-frame Edge Function keeps each
-- timelapse picture after downloading it the first time, so replaying a
-- season does not spend Copernicus quota again. Only the Edge Function
-- (service role) reads and writes it; the browser never touches it.
insert into storage.buckets (id, name, public)
values ('field-frames', 'field-frames', false)
on conflict (id) do nothing;
