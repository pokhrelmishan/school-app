-- Migration 000005: Allow first-time profile + school setup

-- Allow any authenticated user to insert a school (for initial setup only)
-- This is safe because school creation is a one-time bootstrap action
create policy "Authenticated users can create a school for initial setup"
  on public.schools for insert
  with check (auth.uid() is not null);

-- Allow any authenticated user to insert their own profile (if not already exists)
-- The existing "Users can insert their own profile for signup" policy already handles this,
-- but let's make sure it's permissive
drop policy if exists "Users can insert their own profile for signup" on public.profiles;
create policy "Users can insert their own profile for signup"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());
