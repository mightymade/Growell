-- Run once in the Supabase SQL Editor. Safe to run more than once.
--
-- Adds the admin side of Growell:
--   1. Soft delete for fields. Deleting a field hides it from the farmer
--      for good, but the row and its history stay, so the admin can still
--      see what was deleted and when.
--   2. An admin flag (public.admins) and is_admin().
--   3. An audit trail (public.audit_log) that nobody can change or delete,
--      admins included. Data changes are recorded by database triggers, so
--      they cannot be skipped by any app or script.
--   4. log_auth_event(): the app records log in and log out through this.
--   5. log_system_event(): the daily job records failed checks and runs.
--   6. Read-only admin functions. Each one refuses anyone who is not admin.
--   7. One-off history: account and field creation dates are copied into
--      the audit log, so it is not empty on day one.
--
-- No IP addresses or device details are stored anywhere.

-- ===========================================================================
-- 1. Soft delete for fields
-- ===========================================================================
alter table public.fields add column if not exists deleted_at timestamptz;
create index if not exists fields_live_farmer_idx on public.fields (farmer_id) where deleted_at is null;

-- The farmer may read, add and edit only fields that are not deleted. There
-- is no delete policy any more: deleting goes through delete_field() below.
drop policy if exists "fields belong to the farmer" on public.fields;
drop policy if exists "farmers read own live fields" on public.fields;
drop policy if exists "farmers add own fields" on public.fields;
drop policy if exists "farmers edit own live fields" on public.fields;

create policy "farmers read own live fields"
  on public.fields for select
  using (farmer_id = auth.uid() and deleted_at is null);

create policy "farmers add own fields"
  on public.fields for insert
  with check (farmer_id = auth.uid() and deleted_at is null);

-- WITH CHECK keeps deleted_at null, so a farmer cannot set it directly and
-- skip the delete_field() path.
create policy "farmers edit own live fields"
  on public.fields for update
  using (farmer_id = auth.uid() and deleted_at is null)
  with check (farmer_id = auth.uid() and deleted_at is null);

-- True when the signed-in farmer owns this field and it is not deleted.
-- Used by every policy below, so data of a deleted field disappears from
-- the farmer's app everywhere at once (charts, alerts, live updates).
create or replace function public.owns_live_field(p_field_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from fields f
    where f.id = p_field_id and f.farmer_id = auth.uid() and f.deleted_at is null
  );
$$;
revoke all on function public.owns_live_field(uuid) from public, anon;
grant execute on function public.owns_live_field(uuid) to authenticated;

drop policy if exists "satellite images via own field" on public.satellite_images;
create policy "satellite images via own field"
  on public.satellite_images for select
  using (public.owns_live_field(field_id));

drop policy if exists "weather records via own field" on public.weather_records;
create policy "weather records via own field"
  on public.weather_records for select
  using (public.owns_live_field(field_id));

drop policy if exists "anomalies via own field" on public.anomalies;
create policy "anomalies via own field"
  on public.anomalies for select
  using (public.owns_live_field(field_id));

drop policy if exists "farmers can update their own anomaly status" on public.anomalies;
create policy "farmers can update their own anomaly status"
  on public.anomalies for update
  using (public.owns_live_field(field_id))
  with check (public.owns_live_field(field_id));

drop policy if exists "inferred causes via own anomaly" on public.inferred_causes;
create policy "inferred causes via own anomaly"
  on public.inferred_causes for select
  using (exists (select 1 from public.anomalies a where a.id = anomaly_id and public.owns_live_field(a.field_id)));

drop policy if exists "recommendations via own cause" on public.recommendations;
create policy "recommendations via own cause"
  on public.recommendations for select
  using (exists (
    select 1 from public.inferred_causes c
    join public.anomalies a on a.id = c.anomaly_id
    where c.id = cause_id and public.owns_live_field(a.field_id)
  ));

drop policy if exists "alerts via own anomaly" on public.alerts;
create policy "alerts via own anomaly"
  on public.alerts for select
  using (exists (select 1 from public.anomalies a where a.id = anomaly_id and public.owns_live_field(a.field_id)));

drop policy if exists "farmers can mark their own alerts viewed" on public.alerts;
create policy "farmers can mark their own alerts viewed"
  on public.alerts for update
  using (exists (select 1 from public.anomalies a where a.id = anomaly_id and public.owns_live_field(a.field_id)))
  with check (exists (select 1 from public.anomalies a where a.id = anomaly_id and public.owns_live_field(a.field_id)));

-- ===========================================================================
-- 2. Admin flag
-- ===========================================================================
create table if not exists public.admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- No policies on purpose: only the security definer functions below read it.
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ===========================================================================
-- 3. Audit log
-- ===========================================================================
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,          -- null when the system did it. No foreign key, so
                             -- a deleted account keeps its history.
  actor_email text,          -- copied at the time, so the log still reads after account deletion
  actor_name  text,
  action      text not null,
  entity_type text,          -- 'account' | 'field' | 'alert' | 'profile' | 'pipeline'
  entity_id   text,
  entity_name text,          -- copied at the time, e.g. 'North plot'
  details     jsonb not null default '{}'::jsonb,
  source      text not null check (source in ('database', 'app', 'system'))
);
create index if not exists audit_log_time_idx   on public.audit_log (occurred_at desc, id desc);
create index if not exists audit_log_actor_idx  on public.audit_log (actor_id, occurred_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index if not exists audit_log_action_idx on public.audit_log (action);
alter table public.audit_log enable row level security;
-- No select, insert, update or delete policies for anyone.
revoke all on public.audit_log from anon, authenticated;

-- Nobody may rewrite history, including the database owner by mistake in
-- a later patch.
create or replace function public.audit_log_is_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The audit log cannot be changed or deleted.' using errcode = '42501';
end;
$$;
drop trigger if exists audit_log_no_change on public.audit_log;
create trigger audit_log_no_change
  before update or delete on public.audit_log
  for each row execute function public.audit_log_is_append_only();
drop trigger if exists audit_log_no_truncate on public.audit_log;
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_is_append_only();

-- The one way rows get in. Fills in the actor's email and name as they
-- are right now.
create or replace function public.write_audit(
  p_actor       uuid,
  p_action      text,
  p_entity_type text,
  p_entity_id   text,
  p_entity_name text,
  p_details     jsonb,
  p_source      text,
  p_at          timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_name  text;
begin
  if p_actor is not null then
    select u.email, coalesce(f.name, u.raw_user_meta_data->>'name')
      into v_email, v_name
    from auth.users u
    left join farmers f on f.id = u.id
    where u.id = p_actor;
  end if;
  insert into audit_log (occurred_at, actor_id, actor_email, actor_name, action, entity_type, entity_id, entity_name, details, source)
  values (coalesce(p_at, now()), p_actor, v_email, v_name, p_action, p_entity_type, p_entity_id, p_entity_name,
          coalesce(p_details, '{}'::jsonb), p_source);
end;
$$;
revoke all on function public.write_audit(uuid, text, text, text, text, jsonb, text, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3a. Accounts: created, deleted, email changed, password changed
-- ---------------------------------------------------------------------------
create or replace function public.audit_auth_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(new.id, 'account.created', 'account', new.id::text, null, '{}'::jsonb, 'database');
    return new;
  elsif tg_op = 'DELETE' then
    -- Runs before the delete, so the account's name, email and fields are
    -- still there to copy.
    perform write_audit(
      old.id, 'account.deleted', 'account', old.id::text, null,
      jsonb_build_object('field_count', (select count(*) from fields f where f.farmer_id = old.id and f.deleted_at is null)),
      'database');
    return old;
  else
    if new.email is distinct from old.email then
      perform write_audit(new.id, 'account.email_changed', 'account', new.id::text, null,
                          jsonb_build_object('from', old.email, 'to', new.email), 'database');
    end if;
    -- Only the fact that it changed. Never the password or its hash.
    if new.encrypted_password is distinct from old.encrypted_password and old.encrypted_password is not null
       and old.encrypted_password <> '' then
      perform write_audit(new.id, 'account.password_changed', 'account', new.id::text, null, '{}'::jsonb, 'database');
    end if;
    return new;
  end if;
end;
$$;
revoke all on function public.audit_auth_users() from public, anon, authenticated;

-- Named so it runs after on_auth_user_created (triggers run in name order),
-- which creates the farmers row this reads the name from.
drop trigger if exists zz_audit_auth_user_created on auth.users;
create trigger zz_audit_auth_user_created
  after insert on auth.users
  for each row execute function public.audit_auth_users();

drop trigger if exists zz_audit_auth_user_changed on auth.users;
create trigger zz_audit_auth_user_changed
  after update of email, encrypted_password on auth.users
  for each row execute function public.audit_auth_users();

drop trigger if exists zz_audit_auth_user_deleted on auth.users;
create trigger zz_audit_auth_user_deleted
  before delete on auth.users
  for each row execute function public.audit_auth_users();

-- ---------------------------------------------------------------------------
-- 3b. Fields: created, edited, deleted
-- ---------------------------------------------------------------------------
create or replace function public.audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   uuid := auth.uid();
  v_source  text := case when auth.uid() is null then 'system' else 'database' end;
  v_changes jsonb := '{}'::jsonb;
  v_summary jsonb;
begin
  v_summary := jsonb_build_object(
    'crop', new.crop_type,
    'area_ha', round(new.area_hectares::numeric, 2),
    'planting_date', new.planted_date,
    'owner_id', new.farmer_id);

  if tg_op = 'INSERT' then
    perform write_audit(v_actor, 'field.created', 'field', new.id::text, new.field_name, v_summary, v_source);
    return new;
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    perform write_audit(v_actor, 'field.deleted', 'field', new.id::text, old.field_name, v_summary, v_source);
    return new;
  end if;
  if old.deleted_at is not null then
    return new; -- edits to an already deleted row are not the farmer's
  end if;

  -- Only what a person changes. Anything else on the row is ignored, so a
  -- maintenance update never fills the log with noise.
  if new.field_name is distinct from old.field_name then
    v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('from', old.field_name, 'to', new.field_name));
  end if;
  if new.crop_type is distinct from old.crop_type then
    v_changes := v_changes || jsonb_build_object('crop', jsonb_build_object('from', old.crop_type, 'to', new.crop_type));
  end if;
  if new.planted_date is distinct from old.planted_date then
    v_changes := v_changes || jsonb_build_object('planting_date', jsonb_build_object('from', old.planted_date, 'to', new.planted_date));
  end if;
  if new.boundary_coords is distinct from old.boundary_coords then
    v_changes := v_changes || jsonb_build_object('boundary', 'redrawn');
  end if;
  if new.area_hectares is distinct from old.area_hectares then
    v_changes := v_changes || jsonb_build_object('area_ha', jsonb_build_object(
      'from', round(old.area_hectares::numeric, 2), 'to', round(new.area_hectares::numeric, 2)));
  end if;

  if v_changes <> '{}'::jsonb then
    perform write_audit(v_actor, 'field.updated', 'field', new.id::text, new.field_name,
                        jsonb_build_object('changes', v_changes, 'owner_id', new.farmer_id), v_source);
  end if;
  return new;
end;
$$;
revoke all on function public.audit_fields() from public, anon, authenticated;

drop trigger if exists audit_fields_insert on public.fields;
create trigger audit_fields_insert
  after insert on public.fields
  for each row execute function public.audit_fields();

drop trigger if exists audit_fields_update on public.fields;
create trigger audit_fields_update
  after update on public.fields
  for each row execute function public.audit_fields();

-- ---------------------------------------------------------------------------
-- 3c. Profile changes
-- ---------------------------------------------------------------------------
create or replace function public.audit_farmers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  -- Sign-up saves the phone, location and photo a moment after the account
  -- is made. That is part of creating the account, not a later edit.
  if old.date_registered > now() - interval '2 minutes' then
    return new;
  end if;

  if new.name is distinct from old.name then
    v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('from', old.name, 'to', new.name));
  end if;
  -- Contact details: only that they changed, not the values.
  if new.phone_number is distinct from old.phone_number then
    v_changes := v_changes || jsonb_build_object('phone', 'changed');
  end if;
  if new.location is distinct from old.location then
    v_changes := v_changes || jsonb_build_object('location', 'changed');
  end if;
  if new.avatar_url is distinct from old.avatar_url then
    v_changes := v_changes || jsonb_build_object('photo', 'changed');
  end if;
  if new.is_active is distinct from old.is_active then
    v_changes := v_changes || jsonb_build_object('is_active', jsonb_build_object('from', old.is_active, 'to', new.is_active));
  end if;

  if v_changes <> '{}'::jsonb then
    perform write_audit(new.id, 'profile.updated', 'profile', new.id::text, new.name,
                        jsonb_build_object('changes', v_changes),
                        case when auth.uid() is null then 'system' else 'database' end);
  end if;
  return new;
end;
$$;
revoke all on function public.audit_farmers() from public, anon, authenticated;

drop trigger if exists audit_farmers_update on public.farmers;
create trigger audit_farmers_update
  after update on public.farmers
  for each row execute function public.audit_farmers();

-- ---------------------------------------------------------------------------
-- 3d. Alert answers (both submit_alert_feedback and the older two-step save
--     write farmer_feedback, so the trigger catches either)
-- ---------------------------------------------------------------------------
create or replace function public.audit_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_field_id   uuid;
  v_field_name text;
  v_status     text;
  v_cause      text;
begin
  select f.id, f.field_name, an.status, c.cause_type
    into v_field_id, v_field_name, v_status, v_cause
  from alerts al
  join anomalies an on an.id = al.anomaly_id
  join fields f on f.id = an.field_id
  left join inferred_causes c on c.anomaly_id = an.id
  where al.id = new.alert_id
  limit 1;

  perform write_audit(
    new.farmer_id, 'alert.answered', 'alert', new.alert_id::text, v_field_name,
    jsonb_build_object(
      'field_id', v_field_id,
      'field_name', v_field_name,
      'accurate', v_status = 'reviewed',
      'suggested_cause', v_cause,
      'answer', left(new.actual_cause, 500)),
    'database');
  return new;
end;
$$;
revoke all on function public.audit_feedback() from public, anon, authenticated;

drop trigger if exists audit_feedback_write on public.farmer_feedback;
create trigger audit_feedback_write
  after insert or update of actual_cause, date_submitted on public.farmer_feedback
  for each row execute function public.audit_feedback();

-- ===========================================================================
-- 4. Log in and log out, recorded by the app
-- ===========================================================================
create or replace function public.log_auth_event(p_action text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_reason text := case when p_reason in ('button', 'idle', 'deactivated') then p_reason else null end;
begin
  if v_user is null then
    raise exception 'Please log in again.' using errcode = '28000';
  end if;
  if p_action is null or p_action not in ('auth.login', 'auth.logout') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- The same action by the same person within 10 seconds is a double
  -- click or a second tab, not a second log in.
  if exists (
    select 1 from audit_log
    where actor_id = v_user and action = p_action and occurred_at > now() - interval '10 seconds'
  ) then
    return;
  end if;
  perform write_audit(
    v_user, p_action, 'account', v_user::text, null,
    case when p_action = 'auth.login'
         then jsonb_build_object('method', 'password')
         else jsonb_strip_nulls(jsonb_build_object('reason', v_reason)) end,
    'app');
end;
$$;
revoke all on function public.log_auth_event(text, text) from public, anon;
grant execute on function public.log_auth_event(text, text) to authenticated;

-- ===========================================================================
-- 5. Delete a field (soft delete)
-- ===========================================================================
create or replace function public.delete_field(p_field_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please log in again.' using errcode = '28000';
  end if;
  update fields
     set deleted_at = now()
   where id = p_field_id
     and farmer_id = auth.uid()
     and deleted_at is null;
  if not found then
    raise exception 'That field could not be found.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.delete_field(uuid) from public, anon;
grant execute on function public.delete_field(uuid) to authenticated;

-- ===========================================================================
-- 6. Events from the daily job (service role only)
-- ===========================================================================
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
  if p_action not in ('pipeline.check_failed', 'pipeline.run_finished') then
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

-- ===========================================================================
-- 7. Admin read functions. Each one checks is_admin() before anything else.
-- ===========================================================================

-- When someone last did anything we know about: sign in, or a recorded action.
create or replace function public.last_active_at(p_user uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    (select last_sign_in_at from auth.users where id = p_user),
    (select max(occurred_at) from audit_log
      where actor_id = p_user and not coalesce((details->>'backfilled')::boolean, false)));
$$;
revoke all on function public.last_active_at(uuid) from public, anon, authenticated;

-- Rough centre of a field: the average of its outline's corners.
create or replace function public.field_centroid(p_boundary jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case when count(*) = 0 then null
              else jsonb_build_object('lat', avg((pt->>1)::float8), 'lng', avg((pt->>0)::float8)) end
  from jsonb_array_elements(
    coalesce(p_boundary->'coordinates'->0, p_boundary->'geometry'->'coordinates'->0, '[]'::jsonb)
  ) with ordinality as r(pt, n)
  -- The last corner repeats the first one to close the ring; skip it.
  where n < jsonb_array_length(coalesce(p_boundary->'coordinates'->0, p_boundary->'geometry'->'coordinates'->0, '[]'::jsonb))
     or jsonb_array_length(coalesce(p_boundary->'coordinates'->0, p_boundary->'geometry'->'coordinates'->0, '[]'::jsonb)) < 4;
$$;

-- Escape % and _ so a search for "50%" means the text, not a wildcard.
create or replace function public.like_pattern(p text)
returns text
language sql
immutable
as $$
  select '%' || replace(replace(replace(p, '\', '\\'), '%', '\%'), '_', '\_') || '%';
$$;

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.require_admin() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform require_admin();

  select jsonb_build_object(
    'total_users',    (select count(*) from auth.users),
    'new_users_7d',   (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'new_users_30d',  (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_users_7d', (
      select count(distinct uid) from (
        select id as uid from auth.users where last_sign_in_at > now() - interval '7 days'
        union
        select actor_id from audit_log
        where actor_id is not null and occurred_at > now() - interval '7 days'
          and not coalesce((details->>'backfilled')::boolean, false)
      ) s),
    'live_fields',    (select count(*) from fields where deleted_at is null),
    'deleted_fields', (select count(*) from fields where deleted_at is not null),
    'total_ha',       (select coalesce(round(sum(area_hectares)::numeric, 2), 0) from fields where deleted_at is null),
    'open_alerts', (
      select count(*) from anomalies a join fields f on f.id = a.field_id
      where a.status = 'open' and f.deleted_at is null),
    'fields_by_crop', (
      select coalesce(jsonb_agg(jsonb_build_object('crop', crop, 'count', n, 'ha', ha) order by n desc, crop), '[]'::jsonb)
      from (
        select coalesce(nullif(crop_type, ''), 'Other') as crop, count(*) as n,
               coalesce(round(sum(area_hectares)::numeric, 2), 0) as ha
        from fields where deleted_at is null group by 1
      ) c),
    'signups_per_week', (
      select jsonb_agg(jsonb_build_object('week', to_char(w, 'YYYY-MM-DD'), 'count',
               (select count(*) from auth.users u where u.created_at >= w and u.created_at < w + interval '7 days'))
             order by w)
      from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') as w),
    'actions_per_day', (
      select jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'count',
               (select count(*) from audit_log l
                 where l.actor_id is not null and l.occurred_at >= d and l.occurred_at < d + interval '1 day'
                   and not coalesce((l.details->>'backfilled')::boolean, false)))
             order by d)
      from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') as d),
    'last_run', (
      select jsonb_build_object('at', occurred_at, 'details', details)
      from audit_log where action = 'pipeline.run_finished'
      order by occurred_at desc, id desc limit 1),
    'log_started', (
      select min(occurred_at) from audit_log where not coalesce((details->>'backfilled')::boolean, false))
  ) into v;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.admin_users(
  p_search text default null,
  p_sort   text default 'joined',
  p_limit  int  default 25,
  p_offset int  default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit  int := least(greatest(coalesce(p_limit, 25), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_like   text := case when nullif(btrim(p_search), '') is null then null else like_pattern(btrim(p_search)) end;
  v jsonb;
begin
  perform require_admin();

  with u as (
    select au.id,
           coalesce(fm.name, au.raw_user_meta_data->>'name', au.email) as name,
           au.email,
           au.created_at as joined,
           au.last_sign_in_at,
           last_active_at(au.id) as last_active,
           coalesce(fm.is_active, true) as is_active,
           (select count(*) from fields f where f.farmer_id = au.id and f.deleted_at is null) as field_count,
           (select coalesce(round(sum(f.area_hectares)::numeric, 2), 0) from fields f
             where f.farmer_id = au.id and f.deleted_at is null) as total_ha,
           (select count(*) from anomalies a join fields f on f.id = a.field_id
             where f.farmer_id = au.id and f.deleted_at is null and a.status = 'open') as open_alerts
    from auth.users au
    left join farmers fm on fm.id = au.id
    where v_like is null or fm.name ilike v_like or au.email ilike v_like
  ),
  ordered as (
    select u.*, row_number() over (
      order by
        case when p_sort = 'name' then lower(u.name) end asc,
        case when p_sort = 'fields' then u.field_count end desc,
        case when p_sort = 'last_active' then u.last_active end desc nulls last,
        u.joined desc,
        u.id
    ) as rn
    from u
  )
  select jsonb_build_object(
    'total', (select count(*) from u),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(o) - 'rn' order by o.rn)
      from ordered o where o.rn > v_offset and o.rn <= v_offset + v_limit), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.admin_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform require_admin();

  select jsonb_build_object(
    'id', au.id,
    'name', coalesce(fm.name, au.raw_user_meta_data->>'name', au.email),
    'email', au.email,
    'phone', fm.phone_number,
    'location', fm.location,
    'avatar_url', fm.avatar_url,
    'is_active', coalesce(fm.is_active, true),
    'joined', au.created_at,
    'last_sign_in_at', au.last_sign_in_at,
    'last_active', last_active_at(au.id),
    'total_actions', (select count(*) from audit_log l where l.actor_id = au.id
                       and not coalesce((l.details->>'backfilled')::boolean, false)),
    'open_alerts', (select count(*) from anomalies a join fields f on f.id = a.field_id
                     where f.farmer_id = au.id and f.deleted_at is null and a.status = 'open'),
    'fields', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id,
               'name', f.field_name,
               'crop', f.crop_type,
               'area_ha', round(f.area_hectares::numeric, 2),
               'planting_date', f.planted_date,
               'created_at', f.created_at,
               'deleted_at', f.deleted_at,
               'latest_ndvi', s.ndvi_value,
               'last_image', s.capture_date,
               'open_alerts', (select count(*) from anomalies a where a.field_id = f.id and a.status = 'open'))
             order by f.deleted_at nulls first, f.created_at)
      from fields f
      left join lateral (
        select ndvi_value, capture_date from satellite_images si
        where si.field_id = f.id order by capture_date desc limit 1
      ) s on true
      where f.farmer_id = au.id), '[]'::jsonb)
  ) into v
  from auth.users au
  left join farmers fm on fm.id = au.id
  where au.id = p_user_id;

  if v is null then
    raise exception 'That user could not be found.' using errcode = 'P0002';
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.admin_fields(
  p_search text default null,
  p_crop   text default null,
  p_status text default 'live',
  p_limit  int  default 25,
  p_offset int  default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  -- p_status: 'live', 'alerts' (live with an open alert), 'deleted' or 'all'.
  -- The map view asks for every field at once, so the cap is high.
  v_limit  int := least(greatest(coalesce(p_limit, 25), 1), 2000);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_like   text := case when nullif(btrim(p_search), '') is null then null else like_pattern(btrim(p_search)) end;
  v jsonb;
begin
  perform require_admin();

  with f as (
    select fl.id, fl.field_name as name, fl.crop_type as crop,
           round(fl.area_hectares::numeric, 2) as area_ha,
           fl.planted_date as planting_date, fl.created_at, fl.deleted_at,
           fl.farmer_id as owner_id,
           coalesce(fm.name, au.email) as owner_name, au.email as owner_email,
           s.ndvi_value as latest_ndvi, s.capture_date as last_image,
           (select count(*) from anomalies a where a.field_id = fl.id and a.status = 'open') as open_alerts,
           field_centroid(fl.boundary_coords) as centroid
    from fields fl
    left join farmers fm on fm.id = fl.farmer_id
    left join auth.users au on au.id = fl.farmer_id
    left join lateral (
      select ndvi_value, capture_date from satellite_images si
      where si.field_id = fl.id order by capture_date desc limit 1
    ) s on true
    where (coalesce(p_status, 'live') = 'all'
           or (p_status = 'deleted' and fl.deleted_at is not null)
           or (coalesce(p_status, 'live') = 'live' and fl.deleted_at is null)
           or (p_status = 'alerts' and fl.deleted_at is null
               and exists (select 1 from anomalies a where a.field_id = fl.id and a.status = 'open')))
      and (nullif(p_crop, '') is null or coalesce(nullif(fl.crop_type, ''), 'Other') = p_crop)
      and (v_like is null or fl.field_name ilike v_like or fl.id::text ilike v_like
           or fm.name ilike v_like or au.email ilike v_like)
  ),
  ordered as (
    select f.*, row_number() over (order by f.created_at desc, f.id) as rn from f
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(o) - 'rn' order by o.rn)
      from ordered o where o.rn > v_offset and o.rn <= v_offset + v_limit), '[]'::jsonb),
    'crops', (select coalesce(jsonb_agg(distinct coalesce(nullif(crop_type, ''), 'Other')), '[]'::jsonb) from fields)
  ) into v;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.admin_field(p_field_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform require_admin();

  select jsonb_build_object(
    'id', fl.id,
    'name', fl.field_name,
    'crop', fl.crop_type,
    'area_ha', round(fl.area_hectares::numeric, 2),
    'planting_date', fl.planted_date,
    'created_at', fl.created_at,
    'deleted_at', fl.deleted_at,
    'boundary', fl.boundary_coords,
    'owner_id', fl.farmer_id,
    'owner_name', coalesce(fm.name, au.email),
    'owner_email', au.email,
    'ndvi', coalesce((
      select jsonb_agg(jsonb_build_object('capture_date', capture_date, 'ndvi_value', ndvi_value, 'is_approximate', is_approximate)
             order by capture_date)
      from satellite_images where field_id = fl.id), '[]'::jsonb),
    'alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', al.id,
               'date_detected', an.date_detected,
               'severity', an.severity,
               'status', an.status,
               'drop_pct', an.ndvi_drop_pct,
               'cause', c.cause_type,
               'message', al.message_text,
               'answer', fb.actual_cause)
             order by an.date_detected desc)
      from anomalies an
      join alerts al on al.anomaly_id = an.id
      left join inferred_causes c on c.anomaly_id = an.id
      left join farmer_feedback fb on fb.alert_id = al.id
      where an.field_id = fl.id), '[]'::jsonb)
  ) into v
  from fields fl
  left join farmers fm on fm.id = fl.farmer_id
  left join auth.users au on au.id = fl.farmer_id
  where fl.id = p_field_id;

  if v is null then
    raise exception 'That field could not be found.' using errcode = 'P0002';
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.admin_audit_log(
  p_actor       uuid        default null,
  p_actions     text[]      default null,
  p_entity_id   text        default null,
  p_search      text        default null,
  p_from        timestamptz default null,
  p_to          timestamptz default null,
  p_before_time timestamptz default null,
  p_before_id   bigint      default null,
  p_limit       int         default 50
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  -- Up to 10,000 for the CSV export; the list asks for 50 at a time.
  v_limit int  := least(greatest(coalesce(p_limit, 50), 1), 10000);
  v_like  text := case when nullif(btrim(p_search), '') is null then null else like_pattern(btrim(p_search)) end;
  v_rows  jsonb;
  v_count int;
begin
  perform require_admin();

  select coalesce(jsonb_agg(to_jsonb(r) order by r.occurred_at desc, r.id desc), '[]'::jsonb), count(*)
    into v_rows, v_count
  from (
    select l.id, l.occurred_at, l.actor_id, l.actor_email, l.actor_name, l.action,
           l.entity_type, l.entity_id, l.entity_name, l.details, l.source
    from audit_log l
    where (p_actor is null or l.actor_id = p_actor)
      and (p_actions is null or cardinality(p_actions) = 0 or l.action = any (p_actions))
      and (nullif(p_entity_id, '') is null or l.entity_id = p_entity_id)
      and (p_from is null or l.occurred_at >= p_from)
      and (p_to is null or l.occurred_at < p_to)
      and (v_like is null or l.actor_email ilike v_like or l.actor_name ilike v_like
           or l.entity_name ilike v_like or l.entity_id ilike v_like)
      and (p_before_time is null or (l.occurred_at, l.id) < (p_before_time, coalesce(p_before_id, 9223372036854775807)))
    order by l.occurred_at desc, l.id desc
    limit v_limit + 1
  ) r;

  -- One extra row was fetched only to know whether there is another page.
  if v_count > v_limit then
    v_rows := v_rows - v_limit;
  end if;
  return jsonb_build_object('rows', v_rows, 'has_more', v_count > v_limit);
end;
$$;

-- ---------------------------------------------------------------------------
create or replace function public.admin_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform require_admin();

  select jsonb_build_object(
    'runs', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'at', occurred_at, 'details', details) order by occurred_at desc)
      from (select id, occurred_at, details from audit_log
            where action = 'pipeline.run_finished' order by occurred_at desc, id desc limit 14) r), '[]'::jsonb),
    'stale_fields', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.days_since desc nulls first)
      from (
        select fl.id, fl.field_name as name, fl.crop_type as crop,
               fl.farmer_id as owner_id, coalesce(fm.name, au.email) as owner_name,
               li.last_image,
               case when li.last_image is null then null else current_date - li.last_image end as days_since,
               (select l.details->>'reason' from audit_log l
                 where l.action = 'pipeline.check_failed' and l.entity_id = fl.id::text
                 order by l.occurred_at desc, l.id desc limit 1) as last_failure
        from fields fl
        left join farmers fm on fm.id = fl.farmer_id
        left join auth.users au on au.id = fl.farmer_id
        left join lateral (select max(capture_date) as last_image from satellite_images si where si.field_id = fl.id) li on true
        where fl.deleted_at is null
          and ((li.last_image is null and fl.created_at < now() - interval '2 days')
               or li.last_image < current_date - 10)
      ) s), '[]'::jsonb),
    'failures_per_day', (
      select jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'count',
               (select count(*) from audit_log l
                 where l.action = 'pipeline.check_failed' and l.occurred_at >= d and l.occurred_at < d + interval '1 day'))
             order by d)
      from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') as d)
  ) into v;
  return v;
end;
$$;

-- Only signed-in users may call these, and each one refuses non-admins.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.admin_overview()',
    'public.admin_users(text, text, int, int)',
    'public.admin_user(uuid)',
    'public.admin_fields(text, text, text, int, int)',
    'public.admin_field(uuid)',
    'public.admin_audit_log(uuid, text[], text, text, timestamptz, timestamptz, timestamptz, bigint, int)',
    'public.admin_health()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- ===========================================================================
-- 8. One-off history, so the log is not empty on day one. Marked
--    backfilled, and skipped if it was already added by an earlier run.
-- ===========================================================================
insert into public.audit_log (occurred_at, actor_id, actor_email, actor_name, action, entity_type, entity_id, entity_name, details, source)
select u.created_at, u.id, u.email, coalesce(f.name, u.raw_user_meta_data->>'name'),
       'account.created', 'account', u.id::text, null, '{"backfilled": true}'::jsonb, 'database'
from auth.users u
left join public.farmers f on f.id = u.id
where not exists (
  select 1 from public.audit_log l where l.action = 'account.created' and l.entity_id = u.id::text
);

insert into public.audit_log (occurred_at, actor_id, actor_email, actor_name, action, entity_type, entity_id, entity_name, details, source)
select fl.created_at, fl.farmer_id, u.email, fm.name,
       'field.created', 'field', fl.id::text, fl.field_name,
       jsonb_build_object('crop', fl.crop_type, 'area_ha', round(fl.area_hectares::numeric, 2),
                          'planting_date', fl.planted_date, 'owner_id', fl.farmer_id, 'backfilled', true),
       'database'
from public.fields fl
left join public.farmers fm on fm.id = fl.farmer_id
left join auth.users u on u.id = fl.farmer_id
where not exists (
  select 1 from public.audit_log l where l.action = 'field.created' and l.entity_id = fl.id::text
);

-- ===========================================================================
-- 9. Make your account admin. Put your own email in, then run this line on
--    its own (remove the two dashes first).
-- ===========================================================================
-- insert into public.admins (user_id) select id from auth.users where email = 'YOUR_EMAIL' on conflict do nothing;

-- ===========================================================================
-- 10. Checks. Run each block on its own in the SQL Editor after the patch.
--     Replace FARMER_ID with a normal (non-admin) user's id and FIELD_ID
--     with one of that user's fields. Each block says what should happen.
--     Blocks that change data end with rollback, so nothing is kept.
-- ===========================================================================
-- (a) A normal user cannot call any admin function. Expect: ERROR not allowed
-- begin;
--   select set_config('request.jwt.claims', '{"sub":"FARMER_ID","role":"authenticated"}', true);
--   set local role authenticated;
--   select public.admin_overview();
-- rollback;
--
-- (b) A normal user cannot read or write the audit log or admins.
--     Expect: ERROR permission denied, for each line (run them one by one)
-- begin;
--   select set_config('request.jwt.claims', '{"sub":"FARMER_ID","role":"authenticated"}', true);
--   set local role authenticated;
--   select * from public.audit_log limit 1;
-- rollback;
--   (repeat with: insert into public.audit_log (action, source) values ('x', 'app');
--                 update public.audit_log set action = 'x';
--                 delete from public.audit_log;
--                 select * from public.admins;)
--
-- (c) log_auth_event refuses other actions. Expect: ERROR not allowed
-- begin;
--   select set_config('request.jwt.claims', '{"sub":"FARMER_ID","role":"authenticated"}', true);
--   set local role authenticated;
--   select public.log_auth_event('field.deleted');
-- rollback;
--
-- (d) Nobody can change history, not even the database owner.
--     Expect: ERROR The audit log cannot be changed or deleted.
-- update public.audit_log set action = 'x' where id = (select min(id) from public.audit_log);
-- delete from public.audit_log where id = (select min(id) from public.audit_log);
--
-- (e) delete_field hides the field and writes exactly one field.deleted row.
--     Expect: visible_after = 0, deleted_rows = 1, with the field's name.
-- begin;
--   select set_config('request.jwt.claims', '{"sub":"FARMER_ID","role":"authenticated"}', true);
--   set local role authenticated;
--   select public.delete_field('FIELD_ID');
--   select count(*) as visible_after from public.fields where id = 'FIELD_ID';
--   reset role;
--   select count(*) as deleted_rows, max(entity_name) as name
--   from public.audit_log where action = 'field.deleted' and entity_id = 'FIELD_ID';
-- rollback;
--
-- (f) An update that changes nothing a person edits writes no field.updated row.
--     Expect: 0
-- begin;
--   update public.fields set field_name = field_name where id = 'FIELD_ID';
--   select count(*) from public.audit_log
--   where action = 'field.updated' and entity_id = 'FIELD_ID' and occurred_at >= now();
-- rollback;
