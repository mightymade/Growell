-- Run once in the Supabase SQL Editor, AFTER patch_012. Safe to run more than once.
--
-- Fix: the admin Overview counted deleted accounts as "active this week",
-- because their history stays in the activity log. That could show more
-- active users than users (for example "4 active, 133% of users").
-- Now only accounts that still exist are counted.

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
    -- Only accounts that still exist: a deleted account's history stays in
    -- the log, but it must not count as an active user (that gave >100%).
    'active_users_7d', (
      select count(distinct uid) from (
        select id as uid from auth.users where last_sign_in_at > now() - interval '7 days'
        union
        select l.actor_id from audit_log l
        join auth.users u on u.id = l.actor_id
        where l.occurred_at > now() - interval '7 days'
          and not coalesce((l.details->>'backfilled')::boolean, false)
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

