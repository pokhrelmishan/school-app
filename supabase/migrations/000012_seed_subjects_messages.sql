-- 000012_seed_subjects_messages.sql
-- Run this AFTER 000012_add_subjects_messages.sql

DO $$
DECLARE
  v_school_id UUID := '11111111-1111-1111-1111-111111111111';
  v_teacher1_id UUID;
  v_teacher2_id UUID;
  v_class1_id UUID;
  v_class2_id UUID;
  v_math_id UUID;
  v_english_id UUID;
  v_science_id UUID;
  v_student1_id UUID;
  v_student2_id UUID;
BEGIN
  -- Get IDs
  SELECT id INTO v_teacher1_id FROM profiles WHERE school_id = v_school_id AND role = 'teacher' LIMIT 1;
  SELECT id INTO v_teacher2_id FROM profiles WHERE school_id = v_school_id AND role = 'teacher' OFFSET 1 LIMIT 1;
  SELECT id INTO v_class1_id FROM classes WHERE school_id = v_school_id LIMIT 1;
  SELECT id INTO v_class2_id FROM classes WHERE school_id = v_school_id OFFSET 1 LIMIT 1;
  SELECT id INTO v_student1_id FROM profiles WHERE school_id = v_school_id AND role = 'student' LIMIT 1;
  SELECT id INTO v_student2_id FROM profiles WHERE school_id = v_school_id AND role = 'student' OFFSET 1 LIMIT 1;

  IF v_class2_id IS NULL THEN v_class2_id := v_class1_id; END IF;
  IF v_teacher2_id IS NULL THEN v_teacher2_id := v_teacher1_id; END IF;

  -- Subjects
  INSERT INTO subjects (id, name, school_id) VALUES
    (gen_random_uuid(), 'Mathematics', v_school_id),
    (gen_random_uuid(), 'English', v_school_id),
    (gen_random_uuid(), 'Science', v_school_id)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_math_id FROM subjects WHERE school_id = v_school_id AND name = 'Mathematics' LIMIT 1;
  SELECT id INTO v_english_id FROM subjects WHERE school_id = v_school_id AND name = 'English' LIMIT 1;
  SELECT id INTO v_science_id FROM subjects WHERE school_id = v_school_id AND name = 'Science' LIMIT 1;

  -- Teacher-subject assignments
  -- Teacher 1 teaches Math to both classes (class teacher of class 1)
  INSERT INTO teacher_subjects (teacher_id, subject_id, class_id, school_id) VALUES
    (v_teacher1_id, v_math_id, v_class1_id, v_school_id),
    (v_teacher1_id, v_math_id, v_class2_id, v_school_id)
  ON CONFLICT DO NOTHING;

  -- Teacher 2 teaches English and Science to class 2 (class teacher of class 2)
  INSERT INTO teacher_subjects (teacher_id, subject_id, class_id, school_id) VALUES
    (v_teacher2_id, v_english_id, v_class2_id, v_school_id),
    (v_teacher2_id, v_science_id, v_class2_id, v_school_id),
    (v_teacher2_id, v_science_id, v_class1_id, v_school_id)
  ON CONFLICT DO NOTHING;

  -- Sample messages
  IF v_student1_id IS NOT NULL THEN
    INSERT INTO messages (sender_id, recipient_id, body) VALUES
      (v_teacher1_id, v_student1_id, 'Welcome to Mathematics class! Please make sure you have your textbook ready for next week.'),
      (v_teacher1_id, v_student1_id, 'Your quiz results are available. Come see me during office hours if you have questions.');
  END IF;

  IF v_student2_id IS NOT NULL THEN
    INSERT INTO messages (sender_id, recipient_id, body) VALUES
      (v_teacher2_id, v_student2_id, 'Remember to submit your lab report by Friday. Let me know if you need help.'),
      (v_teacher2_id, v_student2_id, 'Great work on the English essay! Keep it up.');
  END IF;

  -- Update student profiles with grade/roll/house if not set
  UPDATE profiles SET
    grade_level = COALESCE(grade_level, '10'),
    roll_number = COALESCE(roll_number, '001'),
    house = COALESCE(house, 'Red')
  WHERE school_id = v_school_id AND role = 'student'
    AND (grade_level IS NULL OR roll_number IS NULL OR house IS NULL);

END $$;
