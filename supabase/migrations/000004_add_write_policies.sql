-- Migration 000004: Add write policies for tables with only SELECT policies

-- Policies for schools (admin only, with school_id constraint)
create policy "Admins can write schools"
  on public.schools for insert
  with check ((select role from public.profiles where id = auth.uid()) = 'admin' and id in (select school_id from public.profiles where id = auth.uid()));

create policy "Admins can write schools"
  on public.schools for update
  using ((select role from public.profiles where id = auth.uid()) = 'admin' and id in (select school_id from public.profiles where id = auth.uid()));

create policy "Admins can write schools"
  on public.schools for delete
  using ((select role from public.profiles where id = auth.uid()) = 'admin' and id in (select school_id from public.profiles where id = auth.uid()));

-- Policies for profiles (admin only, plus self-insert for signup)
create policy "Admins can write profiles"
  on public.profiles for insert
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

create policy "Users can insert their own profile for signup"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "Admins can write profiles"
  on public.profiles for update
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

create policy "Admins can write profiles"
  on public.profiles for delete
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Policies for classes (admin only, with school_id constraint)
create policy "Admins can write classes"
  on public.classes for insert
  with check ((select role from public.profiles where id = auth.uid()) = 'admin' and school_id in (select school_id from public.profiles where id = auth.uid()));

create policy "Admins can write classes"
  on public.classes for update
  using ((select role from public.profiles where id = auth.uid()) = 'admin' and school_id in (select school_id from public.profiles where id = auth.uid()));

create policy "Admins can write classes"
  on public.classes for delete
  using ((select role from public.profiles where id = auth.uid()) = 'admin' and school_id in (select school_id from public.profiles where id = auth.uid()));

-- Policies for class_enrollments (admin only, with school_id constraint)
create policy "Admins can write class_enrollments"
  on public.class_enrollments for insert
  with check ((select role from public.profiles where id = auth.uid()) = 'admin' and class_id in (select id from public.classes where school_id in (select school_id from public.profiles where id = auth.uid())));

create policy "Admins can write class_enrollments"
  on public.class_enrollments for update
  using ((select role from public.profiles where id = auth.uid()) = 'admin' and class_id in (select id from public.classes where school_id in (select school_id from public.profiles where id = auth.uid())));

create policy "Admins can write class_enrollments"
  on public.class_enrollments for delete
  using ((select role from public.profiles where id = auth.uid()) = 'admin' and class_id in (select id from public.classes where school_id in (select school_id from public.profiles where id = auth.uid())));

-- Policies for parent_students (admin only, with school_id constraint)
create policy "Admins can write parent_students"
  on public.parent_students for insert
  with check ((select role from public.profiles where id = auth.uid()) = 'admin' and parent_id in (select id from public.profiles where school_id in (select school_id from public.profiles where id = auth.uid())));

create policy "Admins can write parent_students"
  on public.parent_students for update
  using ((select role from public.profiles where id = auth.uid()) = 'admin' and parent_id in (select id from public.profiles where school_id in (select school_id from public.profiles where id = auth.uid())));

create policy "Admins can write parent_students"
  on public.parent_students for delete
  using ((select role from public.profiles where id = auth.uid()) = 'admin' and parent_id in (select id from public.profiles where school_id in (select school_id from public.profiles where id = auth.uid())));