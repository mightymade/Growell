-- Run once in the Supabase SQL Editor, AFTER patch_010. Safe to run more than once.
--
-- 1. Consent: records which version of the Terms of Use and Privacy Policy
--    each farmer accepted, and when. Required by the Data Protection and
--    Privacy Act, 2019 (s.7: consent before collecting personal data).
-- 2. Deleted accounts: when an account is deleted, its name, email and
--    free-text answers are removed from the activity history (s.16 and
--    s.18: delete or de-identify personal data that is no longer needed).
--    The events stay, so the audit trail still adds up, but they now read
--    "Deleted user". Nothing else can change the history.
-- 3. Alert accuracy for the admin: how often farmers said an alert was right.
-- 4. Setup steps (at the bottom) for the secret key that now protects the
--    daily satellite check, and its daily schedule.

-- ===========================================================================
-- 1. Consent records
-- ===========================================================================
alter table public.farmers add column if not exists terms_version text;
alter table public.farmers add column if not exists terms_accepted_at timestamptz;

-- The farmer accepts the current Terms and Privacy Policy. Recorded on their
-- own row and in the activity history.
create or replace function public.accept_terms(p_version text, p_accepted_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  -- Accepted at sign-up (before the email was confirmed) or right now.
  -- Never in the future, and never more than 30 days back.
  v_at timestamptz := least(now(), greatest(coalesce(p_accepted_at, now()), now() - interval '30 days'));
begin
  if v_user is null then
    raise exception 'Please log in again.' using errcode = '28000';
  end if;
  if p_version is null or p_version !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Unknown version.' using errcode = '22023';
  end if;
  if exists (select 1 from farmers where id = v_user and terms_version = p_version) then
    return; -- already accepted this version
  end if;
  update farmers set terms_version = p_version, terms_accepted_at = v_at where id = v_user;
  perform write_audit(v_user, 'account.terms_accepted', 'account', v_user::text, null,
                      jsonb_build_object('version', p_version), 'app', v_at);
end;
$$;
revoke all on function public.accept_terms(text, timestamptz) from public, anon;
grant execute on function public.accept_terms(text, timestamptz) to authenticated;

-- ===========================================================================
-- 2. De-identify a deleted account's history
-- ===========================================================================

-- The history still cannot be edited or deleted. The one exception is the
-- de-identification below, which may only blank names, emails and personal
-- details of ONE account, and only inside anonymize_account_history().
create or replace function public.audit_log_is_append_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.actor_id is not null
     and coalesce(current_setting('growell.anonymize', true), '') = old.actor_id::text
     and new.id = old.id
     and new.occurred_at = old.occurred_at
     and new.actor_id is not distinct from old.actor_id
     and new.action = old.action
     and new.entity_type is not distinct from old.entity_type
     and new.entity_id is not distinct from old.entity_id
     and new.source = old.source
     and new.actor_email is null
     and new.actor_name = 'Deleted user' then
    return new;
  end if;
  raise exception 'The audit log cannot be changed or deleted.' using errcode = '42501';
end;
$$;

create or replace function public.anonymize_account_history(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('growell.anonymize', p_user::text, true);
  update audit_log
     set actor_email = null,
         actor_name  = 'Deleted user',
         -- The profile's own name.
         entity_name = case when entity_type in ('account', 'profile') then null else entity_name end,
         details = case
           when action = 'account.email_changed' then '{}'::jsonb
           when action = 'profile.updated' then details #- '{changes,name}'
           when action = 'alert.answered' then details - 'answer'
           else details
         end
   where actor_id = p_user;
  perform set_config('growell.anonymize', '', true);
end;
$$;
revoke all on function public.anonymize_account_history(uuid) from public, anon, authenticated;

-- Same as patch_010, plus: sign-up records the Terms version accepted, and
-- account deletion de-identifies the account's history.
create or replace function public.audit_auth_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(new.id, 'account.created', 'account', new.id::text, null,
                        jsonb_strip_nulls(jsonb_build_object('terms_version', new.raw_user_meta_data->>'terms_version')),
                        'database');
    return new;
  elsif tg_op = 'DELETE' then
    perform write_audit(
      old.id, 'account.deleted', 'account', old.id::text, null,
      jsonb_build_object('field_count', (select count(*) from fields f where f.farmer_id = old.id and f.deleted_at is null)),
      'database');
    perform anonymize_account_history(old.id);
    return old;
  else
    if new.email is distinct from old.email then
      perform write_audit(new.id, 'account.email_changed', 'account', new.id::text, null,
                          jsonb_build_object('from', old.email, 'to', new.email), 'database');
    end if;
    if new.encrypted_password is distinct from old.encrypted_password and old.encrypted_password is not null
       and old.encrypted_password <> '' then
      perform write_audit(new.id, 'account.password_changed', 'account', new.id::text, null, '{}'::jsonb, 'database');
    end if;
    return new;
  end if;
end;
$$;
revoke all on function public.audit_auth_users() from public, anon, authenticated;

-- ===========================================================================
-- 3. Alert accuracy (admin only)
-- ===========================================================================
create or replace function public.admin_alert_accuracy()
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
  with a as (
    select an.status, coalesce(c.cause_type, 'unknown') as cause
    from anomalies an
    join alerts al on al.anomaly_id = an.id
    left join inferred_causes c on c.anomaly_id = an.id
  )
  select jsonb_build_object(
    'alerts',    (select count(*) from a),
    'answered',  (select count(*) from a where status in ('reviewed', 'dismissed')),
    'confirmed', (select count(*) from a where status = 'reviewed'),
    'by_cause',  coalesce((
      select jsonb_agg(jsonb_build_object('cause', cause, 'answered', answered, 'confirmed', confirmed) order by answered desc, cause)
      from (
        select cause,
               count(*) filter (where status in ('reviewed', 'dismissed')) as answered,
               count(*) filter (where status = 'reviewed') as confirmed
        from a group by cause
      ) x
      where answered > 0), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;
revoke all on function public.admin_alert_accuracy() from public, anon;
grant execute on function public.admin_alert_accuracy() to authenticated;

-- ===========================================================================
-- 4. Daily satellite check: secret key and schedule
--    Do these steps in order. Full instructions are in the README.
-- ===========================================================================
-- (a) Make a long random key on your computer (Command Prompt):
--       node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
--
-- (b) Give it to the function (Command Prompt, in the project folder):
--       npx supabase secrets set PIPELINE_KEY=PASTE_KEY_HERE --project-ref exoufxrprdsdgurwjqfa
--
-- (c) Store the same key in the database's encrypted vault (SQL Editor):
--       select vault.create_secret('PASTE_KEY_HERE', 'pipeline_key');
--
-- (d) Replace the old schedule with one that sends the key (SQL Editor):
--       select cron.unschedule(jobid) from cron.job where jobname = 'daily-pipeline';
--       select cron.schedule('daily-pipeline', '0 3 * * *', $job$
--         select net.http_post(
--           url := 'https://exoufxrprdsdgurwjqfa.supabase.co/functions/v1/daily-pipeline',
--           headers := jsonb_build_object(
--             'Content-Type', 'application/json',
--             'x-pipeline-key', (select decrypted_secret from vault.decrypted_secrets where name = 'pipeline_key')),
--           body := '{}'::jsonb)
--       $job$);
--
-- (e) To run it now instead of waiting for 03:00 UTC, run the same
--     net.http_post(...) select on its own.
