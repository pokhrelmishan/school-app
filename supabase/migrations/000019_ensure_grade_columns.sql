-- Migration 000019: Ensure grade_entries has student_id column

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grade_entries' AND column_name = 'student_id'
  ) THEN
    ALTER TABLE grade_entries ADD COLUMN student_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Also ensure all expected columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grade_entries' AND column_name = 'subject_name'
  ) THEN
    ALTER TABLE grade_entries ADD COLUMN subject_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grade_entries' AND column_name = 'grade_letter'
  ) THEN
    ALTER TABLE grade_entries ADD COLUMN grade_letter TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grade_entries' AND column_name = 'practical_grade'
  ) THEN
    ALTER TABLE grade_entries ADD COLUMN practical_grade TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grade_entries' AND column_name = 'subject_gpa'
  ) THEN
    ALTER TABLE grade_entries ADD COLUMN subject_gpa NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grade_entries' AND column_name = 'overall_gpa'
  ) THEN
    ALTER TABLE grade_entries ADD COLUMN overall_gpa NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grade_entries' AND column_name = 'term'
  ) THEN
    ALTER TABLE grade_entries ADD COLUMN term TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grade_entries' AND column_name = 'title'
  ) THEN
    ALTER TABLE grade_entries ADD COLUMN title TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grade_entries' AND column_name = 'score'
  ) THEN
    ALTER TABLE grade_entries ADD COLUMN score NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grade_entries' AND column_name = 'max_score'
  ) THEN
    ALTER TABLE grade_entries ADD COLUMN max_score NUMERIC DEFAULT 100;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grade_entries' AND column_name = 'entered_by'
  ) THEN
    ALTER TABLE grade_entries ADD COLUMN entered_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grade_entries' AND column_name = 'subject_id'
  ) THEN
    ALTER TABLE grade_entries ADD COLUMN subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;
  END IF;
END $$;
