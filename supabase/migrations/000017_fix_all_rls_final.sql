-- Migration 000017: Fix all RLS to actually work

-- Helper: check if user is a teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') $$;

-- Helper: check if user is class teacher of a class
CREATE OR REPLACE FUNCTION public.is_class_teacher(cid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT EXISTS (SELECT 1 FROM public.classes WHERE id = cid AND teacher_id = auth.uid()) $$;

-- Helper: check if user teaches any subject in a class
CREATE OR REPLACE FUNCTION public.teaches_class(cid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.teacher_subjects WHERE class_id = cid AND teacher_id = auth.uid()
) OR public.is_class_teacher(cid) $$;

-- ============ GRADE_ENTRIES ============
DROP POLICY IF EXISTS "grades_select" ON grade_entries;
DROP POLICY IF EXISTS "grades_insert" ON grade_entries;
DROP POLICY IF EXISTS "grades_update" ON grade_entries;

CREATE POLICY "grades_select" ON grade_entries FOR SELECT
  USING (
    student_id = auth.uid()
    OR is_class_teacher(class_id)
    OR teaches_class(class_id)
  );

CREATE POLICY "grades_insert" ON grade_entries FOR INSERT
  WITH CHECK (
    is_class_teacher(class_id)
    OR teaches_class(class_id)
  );

CREATE POLICY "grades_update" ON grade_entries FOR UPDATE
  USING (
    is_class_teacher(class_id)
    OR teaches_class(class_id)
  );

-- ============ ATTENDANCE_RECORDS ============
DROP POLICY IF EXISTS "attendance_select" ON attendance_records;
DROP POLICY IF EXISTS "attendance_insert" ON attendance_records;
DROP POLICY IF EXISTS "attendance_update" ON attendance_records;

CREATE POLICY "attendance_select" ON attendance_records FOR SELECT
  USING (
    student_id = auth.uid()
    OR is_class_teacher(class_id)
    OR teaches_class(class_id)
  );

CREATE POLICY "attendance_insert" ON attendance_records FOR INSERT
  WITH CHECK (is_class_teacher(class_id));

CREATE POLICY "attendance_update" ON attendance_records FOR UPDATE
  USING (is_class_teacher(class_id));

-- ============ ASSIGNMENTS ============
DROP POLICY IF EXISTS "assignments_select" ON assignments;
DROP POLICY IF EXISTS "assignments_insert" ON assignments;

CREATE POLICY "assignments_select" ON assignments FOR SELECT
  USING (
    class_id IN (
      SELECT class_id FROM class_enrollments WHERE student_id = auth.uid()
    )
    OR is_class_teacher(class_id)
    OR teaches_class(class_id)
  );

CREATE POLICY "assignments_insert" ON assignments FOR INSERT
  WITH CHECK (
    is_class_teacher(class_id)
    OR teaches_class(class_id)
  );

-- ============ CLASS_ENROLLMENTS ============
DROP POLICY IF EXISTS "enrollments_select" ON class_enrollments;

CREATE POLICY "enrollments_select" ON class_enrollments FOR SELECT
  USING (
    student_id = auth.uid()
    OR class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
    OR class_id IN (SELECT class_id FROM teacher_subjects WHERE teacher_id = auth.uid())
  );

-- ============ MESSAGES ============
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;

CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "messages_update" ON messages FOR UPDATE
  USING (recipient_id = auth.uid());

CREATE POLICY "messages_delete" ON messages FOR DELETE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- ============ NOTICES ============
DROP POLICY IF EXISTS "notices_select" ON notices;

CREATE POLICY "notices_select" ON notices FOR SELECT
  USING (school_id = user_school_id());

-- ============ SUBJECTS ============
DROP POLICY IF EXISTS "subjects_select" ON subjects;
DROP POLICY IF EXISTS "subjects_insert" ON subjects;

CREATE POLICY "subjects_select" ON subjects FOR SELECT
  USING (school_id = user_school_id());

CREATE POLICY "subjects_insert" ON subjects FOR INSERT
  WITH CHECK (user_role() = 'admin');

-- ============ TEACHER_SUBJECTS ============
DROP POLICY IF EXISTS "teacher_subjects_select" ON teacher_subjects;

CREATE POLICY "teacher_subjects_select" ON teacher_subjects FOR SELECT
  USING (school_id = user_school_id());

-- ============ PROFILES (students) ============
DROP POLICY IF EXISTS "Students can view own profile" ON profiles;
DROP POLICY IF EXISTS "Teachers can view students in their classes" ON profiles;

CREATE POLICY "Students can view own profile" ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Teachers can view students in their classes" ON profiles FOR SELECT
  USING (
    role = 'student' AND (
      id IN (SELECT student_id FROM class_enrollments WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()))
      OR id IN (SELECT student_id FROM class_enrollments WHERE class_id IN (SELECT class_id FROM teacher_subjects WHERE teacher_id = auth.uid()))
      OR id IN (SELECT student_id FROM profiles WHERE role = 'student' AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()))
    )
  );
