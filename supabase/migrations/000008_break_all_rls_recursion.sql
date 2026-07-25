-- Migration 000008: Break ALL cross-table RLS recursion with helper functions

-- =============================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- These bypass RLS entirely, breaking recursion chains
-- =============================================

create or replace function public.user_school_id()
returns uuid language sql security definer stable
as $$ select school_id from public.profiles where id = auth.uid() $$;

create or replace function public.user_role()
returns text language sql security definer stable
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_student_enrolled(cid uuid)
returns boolean language sql security definer stable
as $$ select exists (select 1 from public.class_enrollments where class_id = cid and student_id = auth.uid()) $$;

create or replace function public.is_class_teacher(cid uuid)
returns boolean language sql security definer stable
as $$ select exists (select 1 from public.classes where id = cid and teacher_id = auth.uid()) $$;

create or replace function public.is_parent_of_student(sid uuid)
returns boolean language sql security definer stable
as $$ select exists (select 1 from public.parent_students where parent_id = auth.uid() and student_id = sid) $$;

-- =============================================
-- SCHOOLS
-- =============================================
drop policy if exists "schools_select" on public.schools;
drop policy if exists "schools_insert" on public.schools;
drop policy if exists "schools_update" on public.schools;
drop policy if exists "schools_delete" on public.schools;
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
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_school" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;
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
-- CLASS_ENROLLMENTS (must come before classes — no cross-table refs)
-- =============================================
drop policy if exists "enrollments_select" on public.class_enrollments;
drop policy if exists "enrollments_insert" on public.class_enrollments;
drop policy if exists "enrollments_delete" on public.class_enrollments;
drop policy if exists "Teachers can view enrollments for their classes" on public.class_enrollments;
drop policy if exists "Students can view their own enrollments" on public.class_enrollments;
drop policy if exists "Admins can write class_enrollments" on public.class_enrollments;

create policy "enrollments_select" on public.class_enrollments for select
  using (
    student_id = auth.uid()
    or public.is_class_teacher(class_id)
  );
create policy "enrollments_insert" on public.class_enrollments for insert
  with check (public.user_role() = 'admin');
create policy "enrollments_delete" on public.class_enrollments for delete
  using (public.user_role() = 'admin');

-- =============================================
-- CLASSES
-- =============================================
drop policy if exists "classes_select" on public.classes;
drop policy if exists "classes_insert" on public.classes;
drop policy if exists "classes_update" on public.classes;
drop policy if exists "classes_delete" on public.classes;
drop policy if exists "Teachers can view their own classes" on public.classes;
drop policy if exists "Students can view classes they are enrolled in" on public.classes;
drop policy if exists "Admins can write classes" on public.classes;

create policy "classes_select" on public.classes for select
  using (
    public.user_role() = 'admin'
    or teacher_id = auth.uid()
    or public.is_student_enrolled(id)
  );
create policy "classes_insert" on public.classes for insert
  with check (public.user_role() = 'admin' and school_id = public.user_school_id());
create policy "classes_update" on public.classes for update
  using (public.user_role() = 'admin' and school_id = public.user_school_id());
create policy "classes_delete" on public.classes for delete
  using (public.user_role() = 'admin' and school_id = public.user_school_id());

-- =============================================
-- PARENT_STUDENTS
-- =============================================
drop policy if exists "parent_students_select" on public.parent_students;
drop policy if exists "parent_students_insert" on public.parent_students;
drop policy if exists "parent_students_delete" on public.parent_students;
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
drop policy if exists "attendance_select" on public.attendance_records;
drop policy if exists "attendance_insert" on public.attendance_records;
drop policy if exists "attendance_update" on public.attendance_records;
drop policy if exists "Teachers can manage attendance for their classes" on public.attendance_records;
drop policy if exists "Students can view their own attendance" on public.attendance_records;
drop policy if exists "Parents can view their children's attendance" on public.attendance_records;

create policy "attendance_select" on public.attendance_records for select
  using (
    student_id = auth.uid()
    or public.is_parent_of_student(student_id)
    or public.is_class_teacher(class_id)
  );
create policy "attendance_insert" on public.attendance_records for insert
  with check (public.is_class_teacher(class_id));
create policy "attendance_update" on public.attendance_records for update
  using (public.is_class_teacher(class_id));

-- =============================================
-- GRADE_ENTRIES
-- =============================================
drop policy if exists "grades_select" on public.grade_entries;
drop policy if exists "grades_insert" on public.grade_entries;
drop policy if exists "grades_update" on public.grade_entries;
drop policy if exists "Teachers can manage grades for their classes" on public.grade_entries;
drop policy if exists "Students can view their own grades" on public.grade_entries;
drop policy if exists "Parents can view their children's grades" on public.grade_entries;

create policy "grades_select" on public.grade_entries for select
  using (
    student_id = auth.uid()
    or public.is_parent_of_student(student_id)
    or public.is_class_teacher(class_id)
  );
create policy "grades_insert" on public.grade_entries for insert
  with check (public.is_class_teacher(class_id));
create policy "grades_update" on public.grade_entries for update
  using (public.is_class_teacher(class_id));
