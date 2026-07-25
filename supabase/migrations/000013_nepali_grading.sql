-- Migration 000013: Nepali-style grading system
-- theory_score + practical_score per subject, overall GPA

-- Add new columns to grade_entries
ALTER TABLE grade_entries ADD COLUMN IF NOT EXISTS theory_score NUMERIC;
ALTER TABLE grade_entries ADD COLUMN IF NOT EXISTS practical_score NUMERIC;
ALTER TABLE grade_entries ADD COLUMN IF NOT EXISTS theory_max NUMERIC DEFAULT 75;
ALTER TABLE grade_entries ADD COLUMN IF NOT EXISTS practical_max NUMERIC DEFAULT 25;

-- Migrate old data: if score exists but theory doesn't, put score into theory
UPDATE grade_entries
SET theory_score = score, theory_max = COALESCE(max_score, 100)
WHERE theory_score IS NULL AND score IS NOT NULL;

-- Update RLS: class teachers can insert/update grades for their classes
-- (already handled by existing policies, but let's make sure)
DROP POLICY IF EXISTS "grades_insert" ON grade_entries;
DROP POLICY IF EXISTS "grades_update" ON grade_entries;

CREATE POLICY "grades_insert" ON grade_entries FOR INSERT
  WITH CHECK (is_class_teacher(class_id));
CREATE POLICY "grades_update" ON grade_entries FOR UPDATE
  USING (is_class_teacher(class_id));
