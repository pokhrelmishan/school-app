-- Seed demo data for Edify International School
-- Run this ONCE in the Supabase SQL Editor

-- Get the existing school ID
DO $$
DECLARE
  v_school_id uuid;
  v_teacher1_id uuid := gen_random_uuid();
  v_teacher2_id uuid := gen_random_uuid();
  v_student1_id uuid := gen_random_uuid();
  v_student2_id uuid := gen_random_uuid();
  v_student3_id uuid := gen_random_uuid();
  v_student4_id uuid := gen_random_uuid();
  v_student5_id uuid := gen_random_uuid();
  v_parent1_id uuid := gen_random_uuid();
  v_parent2_id uuid := gen_random_uuid();
  v_class1_id uuid := gen_random_uuid();
  v_class2_id uuid := gen_random_uuid();
  v_admin_id uuid;
BEGIN
  -- Get the school
  SELECT id INTO v_school_id FROM public.schools LIMIT 1;
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'No school found. Create a school first.';
  END IF;

  -- Get the existing admin user
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;

  -- Create teacher auth users
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
  VALUES
    (v_teacher1_id, 'sarah.jones@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Sarah Jones"}'::jsonb),
    (v_teacher2_id, 'james.wilson@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"James Wilson"}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  -- Create teacher profiles
  INSERT INTO public.profiles (id, school_id, role, full_name, email)
  VALUES
    (v_teacher1_id, v_school_id, 'teacher', 'Sarah Jones', 'sarah.jones@edify.demo'),
    (v_teacher2_id, v_school_id, 'teacher', 'James Wilson', 'james.wilson@edify.demo')
  ON CONFLICT (id) DO NOTHING;

  -- Create classes
  INSERT INTO public.classes (id, school_id, name, grade_level, teacher_id)
  VALUES
    (v_class1_id, v_school_id, 'Mathematics', 'Grade 5', v_teacher1_id),
    (v_class2_id, v_school_id, 'Science', 'Grade 6', v_teacher2_id)
  ON CONFLICT (id) DO NOTHING;

  -- Create student auth users
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
  VALUES
    (v_student1_id, 'aisha.patel@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Aisha Patel"}'::jsonb),
    (v_student2_id, 'omar.hassan@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Omar Hassan"}'::jsonb),
    (v_student3_id, 'lily.chen@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Lily Chen"}'::jsonb),
    (v_student4_id, 'rajan.sharma@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Rajan Sharma"}'::jsonb),
    (v_student5_id, 'emma.brown@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Emma Brown"}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  -- Create student profiles
  INSERT INTO public.profiles (id, school_id, role, full_name, email)
  VALUES
    (v_student1_id, v_school_id, 'student', 'Aisha Patel', 'aisha.patel@edify.demo'),
    (v_student2_id, v_school_id, 'student', 'Omar Hassan', 'omar.hassan@edify.demo'),
    (v_student3_id, v_school_id, 'student', 'Lily Chen', 'lily.chen@edify.demo'),
    (v_student4_id, v_school_id, 'student', 'Rajan Sharma', 'rajan.sharma@edify.demo'),
    (v_student5_id, v_school_id, 'student', 'Emma Brown', 'emma.brown@edify.demo')
  ON CONFLICT (id) DO NOTHING;

  -- Enroll students in classes (Math: students 1-3, Science: students 3-5)
  INSERT INTO public.class_enrollments (class_id, student_id)
  VALUES
    (v_class1_id, v_student1_id),
    (v_class1_id, v_student2_id),
    (v_class1_id, v_student3_id),
    (v_class2_id, v_student3_id),
    (v_class2_id, v_student4_id),
    (v_class2_id, v_student5_id)
  ON CONFLICT DO NOTHING;

  -- Create parent auth users
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
  VALUES
    (v_parent1_id, 'priya.patel@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Priya Patel"}'::jsonb),
    (v_parent2_id, 'yusuf.hassan@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Yusuf Hassan"}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  -- Create parent profiles
  INSERT INTO public.profiles (id, school_id, role, full_name, email)
  VALUES
    (v_parent1_id, v_school_id, 'parent', 'Priya Patel', 'priya.patel@edify.demo'),
    (v_parent2_id, v_school_id, 'parent', 'Yusuf Hassan', 'yusuf.hassan@edify.demo')
  ON CONFLICT (id) DO NOTHING;

  -- Link parents to students
  INSERT INTO public.parent_students (parent_id, student_id)
  VALUES
    (v_parent1_id, v_student1_id),
    (v_parent2_id, v_student2_id)
  ON CONFLICT DO NOTHING;

  -- Create attendance records for last 5 school days (Math class)
  INSERT INTO public.attendance_records (class_id, student_id, date, status)
  VALUES
    (v_class1_id, v_student1_id, current_date - interval '1 day', 'present'),
    (v_class1_id, v_student2_id, current_date - interval '1 day', 'present'),
    (v_class1_id, v_student3_id, current_date - interval '1 day', 'absent'),
    (v_class1_id, v_student1_id, current_date - interval '2 days', 'present'),
    (v_class1_id, v_student2_id, current_date - interval '2 days', 'late'),
    (v_class1_id, v_student3_id, current_date - interval '2 days', 'present'),
    (v_class1_id, v_student1_id, current_date - interval '3 days', 'absent'),
    (v_class1_id, v_student2_id, current_date - interval '3 days', 'present'),
    (v_class1_id, v_student3_id, current_date - interval '3 days', 'present'),
    (v_class1_id, v_student1_id, current_date - interval '4 days', 'present'),
    (v_class1_id, v_student2_id, current_date - interval '4 days', 'present'),
    (v_class1_id, v_student3_id, current_date - interval '4 days', 'late'),
    (v_class1_id, v_student1_id, current_date - interval '5 days', 'present'),
    (v_class1_id, v_student2_id, current_date - interval '5 days', 'absent'),
    (v_class1_id, v_student3_id, current_date - interval '5 days', 'present')
  ON CONFLICT DO NOTHING;

  -- Create attendance records for Science class
  INSERT INTO public.attendance_records (class_id, student_id, date, status)
  VALUES
    (v_class2_id, v_student3_id, current_date - interval '1 day', 'present'),
    (v_class2_id, v_student4_id, current_date - interval '1 day', 'present'),
    (v_class2_id, v_student5_id, current_date - interval '1 day', 'present'),
    (v_class2_id, v_student3_id, current_date - interval '2 days', 'late'),
    (v_class2_id, v_student4_id, current_date - interval '2 days', 'present'),
    (v_class2_id, v_student5_id, current_date - interval '2 days', 'absent'),
    (v_class2_id, v_student3_id, current_date - interval '3 days', 'present'),
    (v_class2_id, v_student4_id, current_date - interval '3 days', 'present'),
    (v_class2_id, v_student5_id, current_date - interval '3 days', 'present')
  ON CONFLICT DO NOTHING;

  -- Create grade entries for Math
  INSERT INTO public.grade_entries (class_id, student_id, title, score, max_score, term)
  VALUES
    (v_class1_id, v_student1_id, 'Midterm Exam', 88, 100, 'Term 1'),
    (v_class1_id, v_student2_id, 'Midterm Exam', 76, 100, 'Term 1'),
    (v_class1_id, v_student3_id, 'Midterm Exam', 92, 100, 'Term 1'),
    (v_class1_id, v_student1_id, 'Homework 1', 18, 20, 'Term 1'),
    (v_class1_id, v_student2_id, 'Homework 1', 15, 20, 'Term 1'),
    (v_class1_id, v_student3_id, 'Homework 1', 20, 20, 'Term 1')
  ON CONFLICT DO NOTHING;

  -- Create grade entries for Science
  INSERT INTO public.grade_entries (class_id, student_id, title, score, max_score, term)
  VALUES
    (v_class2_id, v_student3_id, 'Lab Report 1', 45, 50, 'Term 1'),
    (v_class2_id, v_student4_id, 'Lab Report 1', 38, 50, 'Term 1'),
    (v_class2_id, v_student5_id, 'Lab Report 1', 42, 50, 'Term 1'),
    (v_class2_id, v_student3_id, 'Quiz 1', 9, 10, 'Term 1'),
    (v_class2_id, v_student4_id, 'Quiz 1', 7, 10, 'Term 1'),
    (v_class2_id, v_student5_id, 'Quiz 1', 8, 10, 'Term 1')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Demo data seeded successfully!';
END $$;
