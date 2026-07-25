-- Migration 000021: Timetable, Exams, Fees, Events

-- ============ TIMETABLE ============
CREATE TABLE IF NOT EXISTS timetable (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timetable_select" ON timetable FOR SELECT
  USING (school_id = user_school_id());

CREATE POLICY "timetable_insert" ON timetable FOR INSERT
  WITH CHECK (user_role() = 'admin');

CREATE POLICY "timetable_update" ON timetable FOR UPDATE
  USING (user_role() = 'admin');

CREATE POLICY "timetable_delete" ON timetable FOR DELETE
  USING (user_role() = 'admin');

-- ============ EXAMS ============
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  term TEXT NOT NULL,
  exam_date DATE,
  max_score NUMERIC DEFAULT 100,
  passing_score NUMERIC DEFAULT 40,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exams_select" ON exams FOR SELECT
  USING (school_id = user_school_id());

CREATE POLICY "exams_insert" ON exams FOR INSERT
  WITH CHECK (user_role() = 'admin');

CREATE POLICY "exams_update" ON exams FOR UPDATE
  USING (user_role() = 'admin');

CREATE POLICY "exams_delete" ON exams FOR DELETE
  USING (user_role() = 'admin');

-- ============ EXAM_RESULTS ============
CREATE TABLE IF NOT EXISTS exam_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC,
  grade_letter TEXT,
  remarks TEXT,
  entered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, student_id)
);

ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_results_select" ON exam_results FOR SELECT
  USING (
    student_id = auth.uid()
    OR is_class_teacher((SELECT class_id FROM exams WHERE id = exam_id))
    OR EXISTS (SELECT 1 FROM exams WHERE id = exam_id AND school_id = user_school_id())
  );

CREATE POLICY "exam_results_insert" ON exam_results FOR INSERT
  WITH CHECK (user_role() IN ('admin', 'teacher'));

CREATE POLICY "exam_results_update" ON exam_results FOR UPDATE
  USING (user_role() IN ('admin', 'teacher'));

-- ============ FEES ============
CREATE TABLE IF NOT EXISTS fee_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  grade_level TEXT,
  term TEXT,
  due_date DATE,
  description TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fee_structures_select" ON fee_structures FOR SELECT
  USING (school_id = user_school_id());

CREATE POLICY "fee_structures_insert" ON fee_structures FOR INSERT
  WITH CHECK (user_role() = 'admin');

CREATE POLICY "fee_structures_update" ON fee_structures FOR UPDATE
  USING (user_role() = 'admin');

CREATE POLICY "fee_structures_delete" ON fee_structures FOR DELETE
  USING (user_role() = 'admin');

CREATE TABLE IF NOT EXISTS fee_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_structure_id UUID REFERENCES fee_structures(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash',
  receipt_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fee_payments_select" ON fee_payments FOR SELECT
  USING (
    student_id = auth.uid()
    OR school_id = user_school_id()
  );

CREATE POLICY "fee_payments_insert" ON fee_payments FOR INSERT
  WITH CHECK (user_role() = 'admin');

CREATE POLICY "fee_payments_update" ON fee_payments FOR UPDATE
  USING (user_role() = 'admin');

-- ============ EVENTS ============
CREATE TABLE IF NOT EXISTS school_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  end_date DATE,
  event_type TEXT DEFAULT 'event' CHECK (event_type IN ('event', 'holiday', 'exam', 'meeting', 'activity')),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_events_select" ON school_events FOR SELECT
  USING (school_id = user_school_id());

CREATE POLICY "school_events_insert" ON school_events FOR INSERT
  WITH CHECK (user_role() = 'admin');

CREATE POLICY "school_events_update" ON school_events FOR UPDATE
  USING (user_role() = 'admin');

CREATE POLICY "school_events_delete" ON school_events FOR DELETE
  USING (user_role() = 'admin');

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable(teacher_id);
CREATE INDEX IF NOT EXISTS idx_timetable_day ON timetable(day_of_week);
CREATE INDEX IF NOT EXISTS idx_exams_class ON exams(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON exam_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_fee ON fee_payments(fee_structure_id);
CREATE INDEX IF NOT EXISTS idx_school_events_date ON school_events(event_date);
