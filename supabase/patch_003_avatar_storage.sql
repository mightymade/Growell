-- Run this once in the Supabase SQL Editor on your existing project.
-- Adds profile-picture support: a new column on farmers, plus a public
-- storage bucket with per-user RLS so each farmer can only touch their
-- own avatar file.

alter table public.farmers add column if not exists avatar_url text;

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
