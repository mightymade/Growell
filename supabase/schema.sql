-- Growell database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.
-- Matches the ERD in the System Design Document: Farmer -> Field -> SatelliteImage /
-- WeatherRecord -> Anomaly -> InferredCause -> Recommendation -> Alert -> FarmerFeedback.

create extension if not exists "pgcrypto";

-- 1. Farmers -------------------------------------------------------------
-- One row per authenticated user (id matches auth.users.id).
create table public.farmers (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null,
  phone_number    text,
  location        text,
  avatar_url      text,
  is_active       boolean not null default true,
  date_registered timestamptz not null default now()
);

-- 2. Fields ---------------------------------------------------------------
create table public.fields (
  id              uuid primary key default gen_random_uuid(),
  farmer_id       uuid not null references public.farmers(id) on delete cascade,
  field_name      text not null,
  boundary_coords jsonb not null,        -- GeoJSON polygon drawn on the map
  crop_type       text,
  area_hectares   numeric,
  -- Nullable on purpose: existing fields predate this column, and a
  -- farmer may genuinely not know the exact date. Anomaly detection
  -- falls back to its old behavior whenever this is null — see
  -- daily-pipeline's cropStages logic.
  planted_date    date,
  created_at      timestamptz not null default now()
);

-- 3. Satellite imagery / NDVI readings ------------------------------------
create table public.satellite_images (
  id              uuid primary key default gen_random_uuid(),
  field_id        uuid not null references public.fields(id) on delete cascade,
  capture_date    date not null,
  ndvi_value      numeric not null,
  cloud_cover_pct numeric not null default 0,
  -- True when this reading came from a small-field centroid fallback (a
  -- buffered square near the field's centre) rather than the farmer's
  -- own drawn boundary, because the exact polygon returned no usable
  -- Sentinel-2 pixels. See supabase/functions/_shared/sentinel.ts.
  is_approximate  boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (field_id, capture_date)
);

-- 4. Weather records --------------------------------------------------------
create table public.weather_records (
  id            uuid primary key default gen_random_uuid(),
  field_id      uuid not null references public.fields(id) on delete cascade,
  record_date   date not null,
  rainfall_mm   numeric,
  temperature_c numeric,
  humidity_pct  numeric,
  unique (field_id, record_date)
);

-- 5. Anomalies --------------------------------------------------------------
create table public.anomalies (
  id            uuid primary key default gen_random_uuid(),
  field_id      uuid not null references public.fields(id) on delete cascade,
  date_detected date not null,
  ndvi_drop_pct numeric not null,
  severity      text not null default 'moderate' check (severity in ('low','moderate','high')),
  status        text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at    timestamptz not null default now()
);

-- 6. Inferred causes ----------------------------------------------------------
create table public.inferred_causes (
  id             uuid primary key default gen_random_uuid(),
  anomaly_id     uuid not null references public.anomalies(id) on delete cascade,
  cause_type     text not null,   -- 'drought' | 'excess_rainfall' | 'pest_disease' | 'unknown'
  confidence_pct numeric not null
);

-- 7. Recommendations (the recommendation engine's output) ---------------------
create table public.recommendations (
  id            uuid primary key default gen_random_uuid(),
  cause_id      uuid not null references public.inferred_causes(id) on delete cascade,
  solution_text text not null
);

-- 8. Alerts -------------------------------------------------------------------
create table public.alerts (
  id           uuid primary key default gen_random_uuid(),
  anomaly_id   uuid not null references public.anomalies(id) on delete cascade,
  message_text text not null,
  date_sent    timestamptz not null default now(),
  viewed_flag  boolean not null default false
);

-- 9. Farmer feedback (validation loop) -----------------------------------------
create table public.farmer_feedback (
  id             uuid primary key default gen_random_uuid(),
  alert_id       uuid not null references public.alerts(id) on delete cascade,
  farmer_id      uuid not null references public.farmers(id) on delete cascade,
  actual_cause   text,
  date_submitted timestamptz not null default now()
);

-- ===========================================================================
-- Row Level Security: every farmer can only ever see their own data.
-- ===========================================================================

alter table public.farmers           enable row level security;
alter table public.fields            enable row level security;
alter table public.satellite_images  enable row level security;
alter table public.weather_records   enable row level security;
alter table public.anomalies         enable row level security;
alter table public.inferred_causes   enable row level security;
alter table public.recommendations   enable row level security;
alter table public.alerts            enable row level security;
alter table public.farmer_feedback   enable row level security;

create policy "farmers read/update own row"
  on public.farmers for all
  using (id = auth.uid()) with check (id = auth.uid());

create policy "fields belong to the farmer"
  on public.fields for all
  using (farmer_id = auth.uid()) with check (farmer_id = auth.uid());

create policy "satellite images via own field"
  on public.satellite_images for select
  using (exists (select 1 from public.fields f where f.id = field_id and f.farmer_id = auth.uid()));

create policy "weather records via own field"
  on public.weather_records for select
  using (exists (select 1 from public.fields f where f.id = field_id and f.farmer_id = auth.uid()));

create policy "anomalies via own field"
  on public.anomalies for select
  using (exists (select 1 from public.fields f where f.id = field_id and f.farmer_id = auth.uid()));

create policy "farmers can update their own anomaly status"
  on public.anomalies for update
  -- WITH CHECK matters as much as USING here: USING alone would let a
  -- farmer keep editing a row they already own, but not stop them
  -- re-pointing field_id at someone else's field. WITH CHECK closes that.
  using (exists (select 1 from public.fields f where f.id = field_id and f.farmer_id = auth.uid()))
  with check (exists (select 1 from public.fields f where f.id = field_id and f.farmer_id = auth.uid()));

create policy "inferred causes via own anomaly"
  on public.inferred_causes for select
  using (exists (
    select 1 from public.anomalies a
    join public.fields f on f.id = a.field_id
    where a.id = anomaly_id and f.farmer_id = auth.uid()
  ));

create policy "recommendations via own cause"
  on public.recommendations for select
  using (exists (
    select 1 from public.inferred_causes c
    join public.anomalies a on a.id = c.anomaly_id
    join public.fields f on f.id = a.field_id
    where c.id = cause_id and f.farmer_id = auth.uid()
  ));

create policy "alerts via own anomaly"
  on public.alerts for select
  using (exists (
    select 1 from public.anomalies a
    join public.fields f on f.id = a.field_id
    where a.id = anomaly_id and f.farmer_id = auth.uid()
  ));

create policy "farmers can mark their own alerts viewed"
  on public.alerts for update
  using (exists (
    select 1 from public.anomalies a
    join public.fields f on f.id = a.field_id
    where a.id = anomaly_id and f.farmer_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.anomalies a
    join public.fields f on f.id = a.field_id
    where a.id = anomaly_id and f.farmer_id = auth.uid()
  ));

create policy "farmers manage their own feedback"
  on public.farmer_feedback for all
  using (farmer_id = auth.uid()) with check (farmer_id = auth.uid());

-- New-user helper: create a farmers row automatically at sign-up.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.farmers (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- Profile picture storage. Verified against Supabase's current documented
-- pattern (Sept 2026): a public bucket + per-user-folder RLS, path
-- convention {user_id}/avatar.{ext}. Public bucket means reads via
-- getPublicUrl() don't need their own policy to actually serve the file,
-- but one is added anyway for defensiveness / correctness under the
-- authenticated API too.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Farmers can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Farmers can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Farmers can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
