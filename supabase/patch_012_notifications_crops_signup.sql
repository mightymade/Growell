-- Run once in the Supabase SQL Editor, AFTER patch_011. Safe to run more than once.
--
-- 1. Sign-up: the phone number and location typed at sign-up are now saved
--    even when the account has to confirm its email first.
-- 2. Crops: a field can store its own days-to-harvest, for a crop that
--    isn't on Growell's list.
-- 3. Notifications: each farmer's choices (alerts, weekly report) and the
--    devices they turned notifications on for.
-- 4. Admin: total count for the Activity page, and the weekly report event.
-- 5. Setup steps for the weekly report schedule (at the bottom).

-- ===========================================================================
-- 1. Profile row made at sign-up, with phone and location
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.farmers (id, name, phone_number, location)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), new.email),
    nullif(left(btrim(coalesce(new.raw_user_meta_data->>'phone', '')), 30), ''),
    nullif(left(btrim(coalesce(new.raw_user_meta_data->>'location', '')), 100), '')
  );
  return new;
end;
$$;

-- ===========================================================================
-- 2. Days to harvest for crops not on the list
-- ===========================================================================
alter table public.fields add column if not exists maturity_days integer;
do $$ begin
  alter table public.fields add constraint fields_maturity_days_range check (maturity_days is null or maturity_days between 7 and 3650);
exception when duplicate_object then null;
end $$;

-- ===========================================================================
-- 3. Notifications
-- ===========================================================================
alter table public.farmers add column if not exists notify_alerts boolean not null default true;
alter table public.farmers add column if not exists notify_weekly boolean not null default true;

-- One row per device (browser) that turned notifications on.
create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  farmer_id       uuid not null references public.farmers(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failures        integer not null default 0
);
create index if not exists push_subscriptions_farmer_idx on public.push_subscriptions (farmer_id);
alter table public.push_subscriptions enable row level security;

drop policy if exists "farmers see their own devices" on public.push_subscriptions;
create policy "farmers see their own devices"
  on public.push_subscriptions for select
  using (farmer_id = auth.uid());

drop policy if exists "farmers remove their own devices" on public.push_subscriptions;
create policy "farmers remove their own devices"
  on public.push_subscriptions for delete
  using (farmer_id = auth.uid());

-- Saving goes through this function: if someone else used this browser
-- before, the device now belongs to whoever turned notifications on last.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please log in again.' using errcode = '28000';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'Not a valid device.' using errcode = '22023';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint;
  insert into push_subscriptions (farmer_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300));
end;
$$;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- ===========================================================================
-- 4. Admin
-- ===========================================================================
-- The weekly report is recorded in the activity history too.
create or replace function public.log_system_event(
  p_action      text,
  p_entity_id   text default null,
  p_entity_name text default null,
  p_details     jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_action not in ('pipeline.check_failed', 'pipeline.run_finished', 'pipeline.weekly_summary') then
    raise exception 'unknown system event %', p_action using errcode = '22023';
  end if;
  perform write_audit(
    null, p_action,
    case when p_action = 'pipeline.check_failed' then 'field' else 'pipeline' end,
    p_entity_id, p_entity_name, coalesce(p_details, '{}'::jsonb), 'system');
end;
$$;
revoke all on function public.log_system_event(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_system_event(text, text, text, jsonb) to service_role;

-- How many events match the Activity page's filters (same rules as admin_audit_log).
create or replace function public.admin_audit_count(
  p_actor     uuid        default null,
  p_actions   text[]      default null,
  p_entity_id text        default null,
  p_search    text        default null,
  p_from      timestamptz default null,
  p_to        timestamptz default null
) returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_like text := case when nullif(btrim(p_search), '') is null then null else like_pattern(btrim(p_search)) end;
  v bigint;
begin
  perform require_admin();
  select count(*) into v
  from audit_log l
  where (p_actor is null or l.actor_id = p_actor)
    and (p_actions is null or cardinality(p_actions) = 0 or l.action = any (p_actions))
    and (nullif(p_entity_id, '') is null or l.entity_id = p_entity_id)
    and (p_from is null or l.occurred_at >= p_from)
    and (p_to is null or l.occurred_at < p_to)
    and (v_like is null or l.actor_email ilike v_like or l.actor_name ilike v_like
         or l.entity_name ilike v_like or l.entity_id ilike v_like);
  return v;
end;
$$;
revoke all on function public.admin_audit_count(uuid, text[], text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_audit_count(uuid, text[], text, text, timestamptz, timestamptz) to authenticated;

-- ===========================================================================
-- 5. Weekly report schedule. Run this once, after deploying the notify
--    function and setting the VAPID secrets (see README). Every Monday at
--    04:00 UTC, which is 07:00 in Uganda.
-- ===========================================================================
-- select cron.unschedule(jobid) from cron.job where jobname = 'weekly-report';
-- select cron.schedule('weekly-report', '0 4 * * 1', $job$
--   select net.http_post(
--     url := 'https://exoufxrprdsdgurwjqfa.supabase.co/functions/v1/notify',
--     headers := jsonb_build_object('Content-Type', 'application/json',
--       'x-pipeline-key', (select decrypted_secret from vault.decrypted_secrets where name = 'pipeline_key')),
--     body := '{"kind": "weekly"}'::jsonb)
-- $job$);
