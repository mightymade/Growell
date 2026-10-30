-- Run this once in the Supabase SQL Editor on your existing project.
-- schema.sql now includes planted_date on fresh installs; this adds it
-- to a database that already has the fields table without it.

alter table public.fields add column if not exists planted_date date;
