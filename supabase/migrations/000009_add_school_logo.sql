-- Migration 000009: Add logo_url to schools + storage bucket

alter table public.schools add column logo_url text;

-- Create storage bucket for school logos
insert into storage.buckets (id, name, public)
  values ('school-logos', 'school-logos', true)
  on conflict (id) do nothing;

-- Allow admins to upload logos
create policy "Admins can upload school logos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'school-logos'
    and public.user_role() = 'admin'
  );

-- Anyone can view school logos (public bucket)
create policy "Anyone can view school logos"
  on storage.objects for select
  using (bucket_id = 'school-logos');

-- Allow admins to update their own logos
create policy "Admins can update school logos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'school-logos'
    and public.user_role() = 'admin'
  );

-- Allow admins to delete their own logos
create policy "Admins can delete school logos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'school-logos'
    and public.user_role() = 'admin'
  );
