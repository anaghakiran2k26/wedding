-- Run this in the Supabase SQL editor.
-- Before using it:
-- 1. Create your project in Supabase
-- 2. Create one Auth user for the gallery admin
-- 3. Keep the bucket name as wedding-gallery unless you also change public/supabase-config.js

insert into storage.buckets (id, name, public)
values ('wedding-gallery', 'wedding-gallery', true)
on conflict (id) do update
set public = true;

drop policy if exists "Public can view wedding gallery" on storage.objects;
drop policy if exists "Authenticated users can upload wedding gallery images" on storage.objects;
drop policy if exists "Authenticated users can update wedding gallery images" on storage.objects;
drop policy if exists "Authenticated users can delete wedding gallery images" on storage.objects;

-- Public read access for gallery images
create policy "Public can view wedding gallery"
on storage.objects
for select
to public
using (bucket_id = 'wedding-gallery');

-- Logged-in admin users can upload gallery images
create policy "Authenticated users can upload wedding gallery images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'wedding-gallery');

-- Logged-in admin users can update gallery images
create policy "Authenticated users can update wedding gallery images"
on storage.objects
for update
to authenticated
using (bucket_id = 'wedding-gallery')
with check (bucket_id = 'wedding-gallery');

-- Logged-in admin users can delete gallery images
create policy "Authenticated users can delete wedding gallery images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'wedding-gallery');
