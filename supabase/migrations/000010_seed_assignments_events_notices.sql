-- 000010_seed_assignments_events_notices.sql
-- Run this AFTER 000010_add_assignments_events_notices.sql

-- Get IDs (using known school_id from 000009)
-- Teachers: Avery Morgan teacher-1, Riley Brooks teacher-2
-- Students: Avery Morgan student-1, Riley Brooks student-2, Jordan Quinn student-3, Casey Riley student-4, Morgan Casey student-5

-- Get the first class ID (Math 101 or similar)
DO $$
DECLARE
  v_school_id UUID := '11111111-1111-1111-1111-111111111111';
  v_class1_id UUID;
  v_class2_id UUID;
  v_teacher1_id UUID;
  v_teacher2_id UUID;
BEGIN
  SELECT id INTO v_class1_id FROM classes WHERE school_id = v_school_id LIMIT 1;
  SELECT id INTO v_class2_id FROM classes WHERE school_id = v_school_id OFFSET 1 LIMIT 1;

  SELECT id INTO v_teacher1_id FROM profiles WHERE school_id = v_school_id AND role = 'teacher' LIMIT 1;
  SELECT id INTO v_teacher2_id FROM profiles WHERE school_id = v_school_id AND role = 'teacher' OFFSET 1 LIMIT 1;

  -- If only 1 class, use it for both
  IF v_class2_id IS NULL THEN v_class2_id := v_class1_id; END IF;
  IF v_teacher2_id IS NULL THEN v_teacher2_id := v_teacher1_id; END IF;

  -- Assignments
  INSERT INTO assignments (class_id, school_id, created_by, title, description, due_date) VALUES
    (v_class1_id, v_school_id, v_teacher1_id, 'Chapter 5 Homework', 'Complete exercises 5.1 to 5.8 from the textbook. Show all working.', NOW() + INTERVAL '7 days'),
    (v_class1_id, v_school_id, v_teacher1_id, 'Algebra Quiz Prep', 'Review chapters 3-5 for the upcoming quiz. Practice problems on page 120.', NOW() + INTERVAL '14 days'),
    (v_class2_id, v_school_id, v_teacher2_id, 'Science Lab Report', 'Write a lab report on the photosynthesis experiment conducted in class.', NOW() + INTERVAL '5 days'),
    (v_class2_id, v_school_id, v_teacher2_id, 'Research Project', 'Research and present on a topic of your choice related to biology.', NOW() + INTERVAL '30 days'),
    (v_class1_id, v_school_id, v_teacher1_id, 'Mental Math Challenge', 'Complete the timed mental math worksheet. 50 questions in 15 minutes.', NOW() + INTERVAL '3 days');

  -- Events
  INSERT INTO events (school_id, title, description, event_date, event_type, created_by) VALUES
    (v_school_id, 'Mid-Term Exams Begin', 'Mid-term examinations start for all grades.', CURRENT_DATE + INTERVAL '21 days', 'exam', v_teacher1_id),
    (v_school_id, 'Science Fair', 'Annual science fair showcasing student projects.', CURRENT_DATE + INTERVAL '45 days', 'event', v_teacher2_id),
    (v_school_id, 'Parent-Teacher Meeting', 'Scheduled meetings with parents to discuss student progress.', CURRENT_DATE + INTERVAL '10 days', 'meeting', v_teacher1_id),
    (v_school_id, 'Sports Day', 'Inter-class sports competition.', CURRENT_DATE + INTERVAL '60 days', 'event', v_teacher1_id),
    (v_school_id, 'School Holiday', 'Public holiday - no classes.', CURRENT_DATE + INTERVAL '3 days', 'holiday', v_teacher1_id);

  -- Notices
  INSERT INTO notices (school_id, title, body, target_roles, created_by) VALUES
    (v_school_id, 'Welcome Back!', 'We hope you had a wonderful break. Please check your class schedules and come prepared for an exciting term ahead!', ARRAY['student', 'teacher', 'parent'], v_teacher1_id),
    (v_school_id, 'Library Hours Extended', 'The school library will now be open until 5:00 PM on weekdays to support exam preparation.', ARRAY['student', 'teacher', 'parent'], v_teacher1_id),
    (v_school_id, 'Uniform Policy Reminder', 'Please ensure you are wearing the correct school uniform. Starting next week, students without proper uniform will be asked to go home.', ARRAY['student'], v_teacher1_id),
    (v_school_id, 'New Online Portal', 'We are launching a new parent portal for tracking student progress. Details will be shared via email.', ARRAY['parent', 'teacher'], v_teacher2_id),
    (v_school_id, 'Exam Schedule Released', 'The mid-term exam schedule has been published. Check the notice board or ask your class teacher.', ARRAY['student', 'teacher'], v_teacher1_id);

END $$;
