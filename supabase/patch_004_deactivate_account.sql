-- Run this once in the Supabase SQL Editor on your existing project.
-- Adds a soft "deactivated" flag to farmers. This is a self-service,
-- reversible toggle a farmer controls on their own row (RLS already
-- allows that — the existing "fields belong to the farmer"-style policy
-- on farmers is `for all using (id = auth.uid())`), NOT a real
-- auth-level account disable. A true disable (blocking sign-in itself)
-- needs Supabase's Admin API with a service-role key, which only a
-- secure backend should ever hold — never the browser. This is the
-- honest, safely-buildable version: it hides the app behind a
-- "deactivated" gate and signs the farmer out, and they can undo it
-- themselves next time they log in.

alter table public.farmers add column if not exists is_active boolean not null default true;
