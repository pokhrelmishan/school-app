-- Migration 000007: Fix ALL RLS recursion across every table

-- Helper functions (security definer bypasses RLS)
create or replace function public.user_school_id()
returns uuid language sql security definer stable
as $$ select school_id from public.profiles where id = auth.uid() $$;

create or replace function public.user_role()
returns text language sql security definer stable
as $$ select role from public.profiles where id = auth.uid() $$;

-- =============================================
-- SCHOOLS
-- =============================================
drop policy if exists "Users can view their school" on public.schools;
drop policy if exists "Authenticated users can create a school" on public.schools;
drop policy if exists "Authenticated users can create a school for initial setup" on public.schools;
drop policy if exists "Admins can update their school" on public.schools;
drop policy if exists "Admins can delete their school" on public.schools;
drop policy if exists "Admins can write schools" on public.schools;

create policy "schools_select" on public.schools for select
  using (id = public.user_school_id());
create policy "schools_insert" on public.schools for insert
  with check (auth.uid() is not null);
create policy "schools_update" on public.schools for update
  using (public.user_role() = 'admin' and id = public.user_school_id());
create policy "schools_delete" on public.schools for delete
  using (public.user_role() = 'admin' and id = public.user_school_id());

-- =============================================
-- PROFILES
-- =============================================
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can view profiles in their school" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile for signup" on public.profiles;
drop policy if exists "Admins can write profiles" on public.profiles;
drop policy if exists "Admins can update profiles in their school" on public.profiles;
drop policy if exists "Admins can delete profiles in their school" on public.profiles;

create policy "profiles_select_own" on public.profiles for select
  using (id = auth.uid());
create policy "profiles_select_school" on public.profiles for select
  using (school_id = public.user_school_id());
create policy "profiles_insert_own" on public.profiles for insert
  to authenticated with check (id = auth.uid());
create policy "profiles_update_admin" on public.profiles for update
  using (public.user_role() = 'admin' and school_id = public.user_school_id());
create policy "profiles_delete_admin" on public.profiles for delete
  using (public.user_role() = 'admin' and school_id = public.user_school_id());

-- =============================================
-- CLASSES
-- =============================================
drop policy if exists "Teachers can view their own classes" on public.classes;
drop policy if exists "Students can view classes they are enrolled in" on public.classes;
drop policy if exists "Admins can write classes" on public.classes;

create policy "classes_select" on public.classes for select
  using (
    public.user_role() = 'admin'
    or teacher_id = auth.uid()
    or id in (select class_id from public.class_enrollments where student_id = auth.uid())
  );
create policy "classes_insert" on public.classes for insert
  with check (public.user_role() = 'admin' and school_id = public.user_school_id());
create policy "classes_update" on public.classes for update
  using (public.user_role() = 'admin' and school_id = public.user_school_id());
create policy "classes_delete" on public.classes for delete
  using (public.user_role() = 'admin' and school_id = public.user_school_id());

-- =============================================
-- CLASS_ENROLLMENTS
-- =============================================
drop policy if exists "Teachers can view enrollments for their classes" on public.class_enrollments;
drop policy if exists "Students can view their own enrollments" on public.class_enrollments;
drop policy if exists "Admins can write class_enrollments" on public.class_enrollments;

create policy "enrollments_select" on public.class_enrollments for select
  using (
    student_id = auth.uid()
    or class_id in (select id from public.classes where teacher_id = auth.uid())
  );
create policy "enrollments_insert" on public.class_enrollments for insert
  with check (public.user_role() = 'admin');
create policy "enrollments_delete" on public.class_enrollments for delete
  using (public.user_role() = 'admin');

-- =============================================
-- PARENT_STUDENTS
-- =============================================
drop policy if exists "Admins can write parent_students" on public.parent_students;

create policy "parent_students_select" on public.parent_students for select
  using (parent_id = auth.uid());
create policy "parent_students_insert" on public.parent_students for insert
  with check (public.user_role() = 'admin');
create policy "parent_students_delete" on public.parent_students for delete
  using (public.user_role() = 'admin');

-- =============================================
-- ATTENDANCE_RECORDS
-- =============================================
drop policy if exists "Teachers can manage attendance for their classes" on public.attendance_records;
drop policy if exists "Students can view their own attendance" on public.attendance_records;
drop policy if exists "Parents can view their children's attendance" on public.attendance_records;

create policy "attendance_select" on public.attendance_records for select
  using (
    student_id = auth.uid()
    or student_id in (select student_id from public.parent_students where parent_id = auth.uid())
    or class_id in (select id from public.classes where teacher_id = auth.uid())
  );
create policy "attendance_insert" on public.attendance_records for insert
  with check (class_id in (select id from public.classes where teacher_id = auth.uid()));
create policy "attendance_update" on public.attendance_records for update
  using (class_id in (select id from public.classes where teacher_id = auth.uid()));

-- =============================================
-- GRADE_ENTRIES
-- =============================================
drop policy if exists "Teachers can manage grades for their classes" on public.grade_entries;
drop policy if exists "Students can view their own grades" on public.grade_entries;
drop policy if exists "Parents can view their children's grades" on public.grade_entries;

create policy "grades_select" on public.grade_entries for select
  using (
    student_id = auth.uid()
    or student_id in (select student_id from public.parent_students where parent_id = auth.uid())
    or class_id in (select id from public.classes where teacher_id = auth.uid())
  );
create policy "grades_insert" on public.grade_entries for insert
  with check (class_id in (select id from public.classes where teacher_id = auth.uid()));
create policy "grades_update" on public.grade_entries for update
  using (class_id in (select id from public.classes where teacher_id = auth.uid()));
