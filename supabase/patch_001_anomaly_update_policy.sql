-- Run this once in the Supabase SQL Editor on your existing project.
-- schema.sql only had a SELECT policy on anomalies — without this,
-- the dashboard's "This looks right" / "Not accurate" feedback buttons
-- would silently fail to update anomaly status under RLS.

create policy "farmers can update their own anomaly status"
  on public.anomalies for update
  using (exists (select 1 from public.fields f where f.id = field_id and f.farmer_id = auth.uid()));
