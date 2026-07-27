-- Migration 012 — Product images
-- Run in the Supabase SQL editor. Idempotent.
--
-- Product images are public catalog assets. Only admins may create, replace,
-- or delete files in the bucket.

alter table products
  add column if not exists image_url text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product images admin insert" on storage.objects;
create policy "product images admin insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and has_role(array['admin'::text])
);

drop policy if exists "product images admin update" on storage.objects;
create policy "product images admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and has_role(array['admin'::text])
)
with check (
  bucket_id = 'product-images'
  and has_role(array['admin'::text])
);

drop policy if exists "product images admin delete" on storage.objects;
create policy "product images admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and has_role(array['admin'::text])
);
