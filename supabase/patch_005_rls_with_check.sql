-- Run this once in the Supabase SQL Editor on your existing project.
--
-- Closes a real gap: the UPDATE policies on `anomalies` and `alerts` only
-- had a USING clause, which controls which existing rows you can touch,
-- but no WITH CHECK clause, which controls what the row is allowed to
-- become. Without it, a farmer permitted to update their own anomaly could
-- rewrite its field_id to point at a field belonging to a different
-- farmer (or an alert's anomaly_id to point at someone else's anomaly),
-- effectively reassigning their row onto another farmer's data. The app's
-- own UI never does this, but RLS is the boundary that has to hold even
-- against a client that doesn't play by the UI's rules, so this closes it
-- at the database level. This only allows what the app already does
-- (editing status), it does not add a new capability.

drop policy if exists "farmers can update their own anomaly status" on public.anomalies;
create policy "farmers can update their own anomaly status"
  on public.anomalies for update
  using (exists (select 1 from public.fields f where f.id = field_id and f.farmer_id = auth.uid()))
  with check (exists (select 1 from public.fields f where f.id = field_id and f.farmer_id = auth.uid()));

drop policy if exists "farmers can mark their own alerts viewed" on public.alerts;
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
