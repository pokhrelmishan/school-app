-- Migration 000012: Subjects, teacher_subjects, messages + subject_id on grade_entries

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teacher-subject-class junction
CREATE TABLE IF NOT EXISTS teacher_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (teacher_id, subject_id, class_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add subject_id to grade_entries
ALTER TABLE grade_entries ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Subjects policies
DROP POLICY IF EXISTS "subjects_select" ON subjects;
DROP POLICY IF EXISTS "subjects_insert" ON subjects;
DROP POLICY IF EXISTS "subjects_update" ON subjects;
DROP POLICY IF EXISTS "subjects_delete" ON subjects;

CREATE POLICY "subjects_select" ON subjects FOR SELECT USING (school_id = user_school_id());
CREATE POLICY "subjects_insert" ON subjects FOR INSERT WITH CHECK (user_role() = 'admin');
CREATE POLICY "subjects_update" ON subjects FOR UPDATE USING (user_role() = 'admin');
CREATE POLICY "subjects_delete" ON subjects FOR DELETE USING (user_role() = 'admin');

-- Teacher subjects policies
DROP POLICY IF EXISTS "teacher_subjects_select" ON teacher_subjects;
DROP POLICY IF EXISTS "teacher_subjects_insert" ON teacher_subjects;
DROP POLICY IF EXISTS "teacher_subjects_update" ON teacher_subjects;
DROP POLICY IF EXISTS "teacher_subjects_delete" ON teacher_subjects;

CREATE POLICY "teacher_subjects_select" ON teacher_subjects FOR SELECT USING (school_id = user_school_id());
CREATE POLICY "teacher_subjects_insert" ON teacher_subjects FOR INSERT WITH CHECK (user_role() = 'admin');
CREATE POLICY "teacher_subjects_update" ON teacher_subjects FOR UPDATE USING (user_role() = 'admin');
CREATE POLICY "teacher_subjects_delete" ON teacher_subjects FOR DELETE USING (user_role() = 'admin');

-- Messages policies
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;

CREATE POLICY "messages_select" ON messages FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_update" ON messages FOR UPDATE USING (recipient_id = auth.uid());
CREATE POLICY "messages_delete" ON messages FOR DELETE USING (sender_id = auth.uid() OR recipient_id = auth.uid());
