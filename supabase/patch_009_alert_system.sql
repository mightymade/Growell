-- Run once in the Supabase SQL Editor. Safe to run more than once.
--
-- Makes the alert system reliable:
--   1. create_alert(): the daily job saves a drop, its cause, the advice
--      and the alert in ONE transaction. Before, these were four separate
--      writes; if a later one failed, the farmer got a drop with no alert.
--   2. No repeat alerts: one alert per field per image date, and no new
--      alert while the field already has an unanswered one from the last
--      14 days (the same problem would otherwise alert on every pass).
--   3. submit_alert_feedback(): the farmer's answer updates the alert's
--      status and saves feedback together, once per alert. Confirming an
--      alert now records the cause that was confirmed, for accuracy checks.
--   4. Live updates: new alerts reach an open app without a reload.

-- ---------------------------------------------------------------------------
-- 0. Clean up duplicates left by the old job, so the unique rules below can
--    be added. For each field and date, the earliest drop is kept.
-- ---------------------------------------------------------------------------
delete from public.anomalies a
using public.anomalies b
where a.field_id = b.field_id
  and a.date_detected = b.date_detected
  and (a.created_at, a.id) > (b.created_at, b.id);

-- Drops with no alert were invisible to the farmer. Remove them so the
-- daily job can raise them properly if they still apply.
delete from public.anomalies a
where not exists (select 1 from public.alerts al where al.anomaly_id = a.id);

-- One feedback row per alert (the newest answer wins).
delete from public.farmer_feedback f
using public.farmer_feedback g
where f.alert_id = g.alert_id
  and (f.date_submitted, f.id) < (g.date_submitted, g.id);

create unique index if not exists anomalies_field_date_key on public.anomalies (field_id, date_detected);
create unique index if not exists farmer_feedback_alert_key on public.farmer_feedback (alert_id);
create index if not exists anomalies_field_status_idx on public.anomalies (field_id, status, date_detected desc);
create index if not exists alerts_anomaly_idx on public.alerts (anomaly_id);

-- ---------------------------------------------------------------------------
-- 1. create_alert: used only by the daily job (service role).
-- ---------------------------------------------------------------------------
create or replace function public.create_alert(
  p_field_id      uuid,
  p_date_detected date,
  p_drop_pct      numeric,
  p_severity      text,
  p_cause_type    text,
  p_confidence    numeric,
  p_solution_text text,
  p_message_text  text,
  p_quiet_days    int default 14
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open      record;
  v_anomaly   uuid;
  v_cause     uuid;
  v_alert     uuid;
begin
  -- Already alerted for this exact image date (job re-run): do nothing.
  if exists (select 1 from anomalies where field_id = p_field_id and date_detected = p_date_detected) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- The farmer hasn't answered a recent alert on this field yet. Raising
  -- another for what is almost certainly the same problem is noise.
  select id, date_detected into v_open
  from anomalies
  where field_id = p_field_id
    and status = 'open'
    and date_detected >= p_date_detected - p_quiet_days
  order by date_detected desc
  limit 1;
  if found then
    return jsonb_build_object('status', 'suppressed', 'open_since', v_open.date_detected);
  end if;

  insert into anomalies (field_id, date_detected, ndvi_drop_pct, severity)
  values (p_field_id, p_date_detected, p_drop_pct, p_severity)
  returning id into v_anomaly;

  insert into inferred_causes (anomaly_id, cause_type, confidence_pct)
  values (v_anomaly, p_cause_type, p_confidence)
  returning id into v_cause;

  insert into recommendations (cause_id, solution_text)
  values (v_cause, p_solution_text);

  insert into alerts (anomaly_id, message_text)
  values (v_anomaly, p_message_text)
  returning id into v_alert;

  return jsonb_build_object('status', 'created', 'alert_id', v_alert, 'anomaly_id', v_anomaly);
end;
$$;

revoke all on function public.create_alert(uuid, date, numeric, text, text, numeric, text, text, int) from public, anon, authenticated;
grant execute on function public.create_alert(uuid, date, numeric, text, text, numeric, text, text, int) to service_role;

-- ---------------------------------------------------------------------------
-- 2. submit_alert_feedback: called by the signed-in farmer.
--    Runs as the database owner, so it checks ownership itself first.
-- ---------------------------------------------------------------------------
create or replace function public.submit_alert_feedback(
  p_alert_id   uuid,
  p_accurate   boolean,
  p_correction text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farmer  uuid := auth.uid();
  v_anomaly uuid;
  v_cause   text;
  v_status  text := case when p_accurate then 'reviewed' else 'dismissed' end;
  v_note    text := nullif(btrim(coalesce(p_correction, '')), '');
begin
  if v_farmer is null then
    raise exception 'Please log in again.' using errcode = '28000';
  end if;

  select a.id, c.cause_type into v_anomaly, v_cause
  from alerts al
  join anomalies a on a.id = al.anomaly_id
  join fields f on f.id = a.field_id
  left join inferred_causes c on c.anomaly_id = a.id
  where al.id = p_alert_id and f.farmer_id = v_farmer
  limit 1;

  if v_anomaly is null then
    raise exception 'That alert could not be found.' using errcode = 'P0002';
  end if;
  if not p_accurate and v_note is null then
    raise exception 'Please say what actually happened.' using errcode = '22023';
  end if;
  if length(v_note) > 500 then
    raise exception 'Please keep your answer under 500 characters.' using errcode = '22001';
  end if;

  update anomalies set status = v_status where id = v_anomaly;
  update alerts set viewed_flag = true where id = p_alert_id;

  insert into farmer_feedback (alert_id, farmer_id, actual_cause, date_submitted)
  values (p_alert_id, v_farmer, case when p_accurate then v_cause else v_note end, now())
  on conflict (alert_id) do update
    set actual_cause = excluded.actual_cause,
        date_submitted = excluded.date_submitted;

  return v_status;
end;
$$;

revoke all on function public.submit_alert_feedback(uuid, boolean, text) from public, anon;
grant execute on function public.submit_alert_feedback(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Live updates. Supabase Realtime only sends changes for tables in this
--    publication, and still applies each farmer's row level security.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alerts') then
      execute 'alter publication supabase_realtime add table public.alerts';
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'anomalies') then
      execute 'alter publication supabase_realtime add table public.anomalies';
    end if;
  end if;
end $$;
