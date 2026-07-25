-- 000010_add_assignments_events_notices.sql

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assignment file attachments
CREATE TABLE IF NOT EXISTS assignment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Events table (calendar events: school events, holidays, exams, etc.)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'general',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notices table (announcements from school/admin)
CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_roles TEXT[] DEFAULT ARRAY['student', 'teacher', 'parent'],
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies

-- Assignments: students see assignments for their enrolled classes
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see assignments for enrolled classes" ON assignments
  FOR SELECT USING (
    class_id IN (
      SELECT ce.class_id FROM class_enrollments ce
      WHERE ce.student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers manage assignments for their classes" ON assignments
  FOR ALL USING (
    class_id IN (
      SELECT c.id FROM classes c WHERE c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages all assignments" ON assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Assignment attachments
ALTER TABLE assignment_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see attachments for their class assignments" ON assignment_attachments
  FOR SELECT USING (
    assignment_id IN (
      SELECT a.id FROM assignments a
      JOIN class_enrollments ce ON ce.class_id = a.class_id AND ce.student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers manage attachments for their assignments" ON assignment_attachments
  FOR ALL USING (
    assignment_id IN (
      SELECT a.id FROM assignments a
      JOIN classes c ON c.id = a.class_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages all attachments" ON assignment_attachments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Events: everyone in the school can see
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members see events" ON events
  FOR SELECT USING (
    school_id = user_school_id()
  );

CREATE POLICY "Admin manages events" ON events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Notices: everyone in the school can see
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members see notices" ON notices
  FOR SELECT USING (
    school_id = user_school_id()
  );

CREATE POLICY "Admin manages notices" ON notices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage bucket for assignment files
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-files', 'assignment-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: anyone in school can read
CREATE POLICY "Public read for assignment files" ON storage.objects
  FOR SELECT USING (bucket_id = 'assignment-files');

CREATE POLICY "Teachers upload assignment files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'assignment-files'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );
