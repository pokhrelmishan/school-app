-- Migration 000006: Fix infinite recursion in RLS policies

-- Helper function to get current user's school_id without triggering RLS
create or replace function public.user_school_id()
returns uuid
language sql
security definer
stable
as $$
  select school_id from public.profiles where id = auth.uid()
$$;

-- Helper function to get current user's role without triggering RLS
create or replace function public.user_role()
returns text
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ========== Drop all existing policies on schools ==========
drop policy if exists "Users can view their school" on public.schools;
drop policy if exists "Authenticated users can create a school for initial setup" on public.schools;
drop policy if exists "Admins can write schools" on public.schools;

-- ========== Drop all existing policies on profiles ==========
drop policy if exists "Users can view profiles in their school" on public.profiles;
drop policy if exists "Users can insert their own profile for signup" on public.profiles;
drop policy if exists "Admins can write profiles" on public.profiles;

-- ========== Recreate schools policies (no recursion) ==========
create policy "Users can view their school"
  on public.schools for select
  using (id = public.user_school_id());

create policy "Authenticated users can create a school"
  on public.schools for insert
  with check (auth.uid() is not null);

create policy "Admins can update their school"
  on public.schools for update
  using (public.user_role() = 'admin' and id = public.user_school_id());

create policy "Admins can delete their school"
  on public.schools for delete
  using (public.user_role() = 'admin' and id = public.user_school_id());

-- ========== Recreate profiles policies (no recursion) ==========
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can view profiles in their school"
  on public.profiles for select
  using (school_id = public.user_school_id());

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "Admins can update profiles in their school"
  on public.profiles for update
  using (public.user_role() = 'admin' and school_id = public.user_school_id());

create policy "Admins can delete profiles in their school"
  on public.profiles for delete
  using (public.user_role() = 'admin' and school_id = public.user_school_id());
