-- Migration 000014: Fix grade_entries RLS (drop old policies, recreate clean)

DROP POLICY IF EXISTS "grades_select" ON grade_entries;
DROP POLICY IF EXISTS "grades_insert" ON grade_entries;
DROP POLICY IF EXISTS "grades_update" ON grade_entries;

-- Students see their own grades
CREATE POLICY "grades_select" ON grade_entries FOR SELECT
  USING (
    student_id = auth.uid()
    OR is_class_teacher(class_id)
  );

-- Class teachers insert
CREATE POLICY "grades_insert" ON grade_entries FOR INSERT
  WITH CHECK (is_class_teacher(class_id));

-- Class teachers update
CREATE POLICY "grades_update" ON grade_entries FOR UPDATE
  USING (is_class_teacher(class_id));
