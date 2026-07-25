-- Migration 000013: Grading system
-- Theory grade, Practical grade, Subject GPA per subject, Overall GPA

-- Add columns to grade_entries
ALTER TABLE grade_entries ADD COLUMN IF NOT EXISTS subject_name TEXT;
ALTER TABLE grade_entries ADD COLUMN IF NOT EXISTS grade_letter TEXT;       -- theory grade
ALTER TABLE grade_entries ADD COLUMN IF NOT EXISTS practical_grade TEXT;    -- practical grade
ALTER TABLE grade_entries ADD COLUMN IF NOT EXISTS subject_gpa NUMERIC;
ALTER TABLE grade_entries ADD COLUMN IF NOT EXISTS overall_gpa NUMERIC;

-- Migrate old data
UPDATE grade_entries
SET theory_score = score, theory_max = COALESCE(max_score, 100)
WHERE theory_score IS NULL AND score IS NOT NULL;

-- RLS: class teachers can insert/update grades for their classes
DROP POLICY IF EXISTS "grades_insert" ON grade_entries;
DROP POLICY IF EXISTS "grades_update" ON grade_entries;

CREATE POLICY "grades_insert" ON grade_entries FOR INSERT
  WITH CHECK (is_class_teacher(class_id));
CREATE POLICY "grades_update" ON grade_entries FOR UPDATE
  USING (is_class_teacher(class_id));
