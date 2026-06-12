-- =============================================================================
-- English Library — Storage: book covers bucket (TECH-PLAN D1)
-- Public read (covers shown in catalog & emails); admin-only write.
-- 200 KB cap as a backstop over the client-side resize (TECH-PLAN D6).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'covers',
  'covers',
  true,
  204800,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "covers public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'covers');

create policy "covers admin write" on storage.objects
  for all to authenticated
  using (bucket_id = 'covers' and public.is_admin())
  with check (bucket_id = 'covers' and public.is_admin());
