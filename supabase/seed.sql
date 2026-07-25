-- Seed demo data for Edify International School
-- Run each block separately in Supabase SQL Editor

-- STEP 1: Teachers auth + profiles
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data) VALUES
('a1000000-0000-4000-8000-000000000001', 'sarah.jones@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Sarah Jones"}'::jsonb),
('a1000000-0000-4000-8000-000000000002', 'james.wilson@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"James Wilson"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, school_id, role, full_name, email) VALUES
('a1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'teacher', 'Sarah Jones', 'sarah.jones@edify.demo'),
('a1000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'teacher', 'James Wilson', 'james.wilson@edify.demo')
ON CONFLICT (id) DO NOTHING;

-- STEP 2: Classes
INSERT INTO public.classes (id, school_id, name, grade_level, teacher_id) VALUES
('d1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Mathematics', 'Grade 5', 'a1000000-0000-4000-8000-000000000001'),
('d1000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Science', 'Grade 6', 'a1000000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- STEP 3: Students auth + profiles
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data) VALUES
('b1000000-0000-4000-8000-000000000001', 'aisha.patel@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Aisha Patel"}'::jsonb),
('b1000000-0000-4000-8000-000000000002', 'omar.hassan@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Omar Hassan"}'::jsonb),
('b1000000-0000-4000-8000-000000000003', 'lily.chen@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Lily Chen"}'::jsonb),
('b1000000-0000-4000-8000-000000000004', 'rajan.sharma@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Rajan Sharma"}'::jsonb),
('b1000000-0000-4000-8000-000000000005', 'emma.brown@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Emma Brown"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, school_id, role, full_name, email) VALUES
('b1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'student', 'Aisha Patel', 'aisha.patel@edify.demo'),
('b1000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'student', 'Omar Hassan', 'omar.hassan@edify.demo'),
('b1000000-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'student', 'Lily Chen', 'lily.chen@edify.demo'),
('b1000000-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111', 'student', 'Rajan Sharma', 'rajan.sharma@edify.demo'),
('b1000000-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111', 'student', 'Emma Brown', 'emma.brown@edify.demo')
ON CONFLICT (id) DO NOTHING;

-- STEP 4: Enrollments
INSERT INTO public.class_enrollments (class_id, student_id) VALUES
('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001'),
('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002'),
('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003'),
('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000003'),
('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004'),
('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000005')
ON CONFLICT DO NOTHING;

-- STEP 5: Parents auth + profiles
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data) VALUES
('c1000000-0000-4000-8000-000000000001', 'priya.patel@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Priya Patel"}'::jsonb),
('c1000000-0000-4000-8000-000000000002', 'yusuf.hassan@edify.demo', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Yusuf Hassan"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, school_id, role, full_name, email) VALUES
('c1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'parent', 'Priya Patel', 'priya.patel@edify.demo'),
('c1000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'parent', 'Yusuf Hassan', 'yusuf.hassan@edify.demo')
ON CONFLICT (id) DO NOTHING;

-- STEP 6: Parent-student links
INSERT INTO public.parent_students (parent_id, student_id) VALUES
('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001'),
('c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- STEP 7: Attendance
INSERT INTO public.attendance_records (class_id, student_id, date, status) VALUES
('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', current_date - 1, 'present'),
('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', current_date - 1, 'present'),
('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', current_date - 1, 'absent'),
('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', current_date - 2, 'present'),
('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', current_date - 2, 'late'),
('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', current_date - 2, 'present'),
('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000003', current_date - 1, 'present'),
('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', current_date - 1, 'present'),
('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000005', current_date - 1, 'present')
ON CONFLICT DO NOTHING;

-- STEP 8: Grades
INSERT INTO public.grade_entries (class_id, student_id, title, score, max_score, term) VALUES
('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Midterm Exam', 88, 100, 'Term 1'),
('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Midterm Exam', 76, 100, 'Term 1'),
('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 'Midterm Exam', 92, 100, 'Term 1'),
('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000003', 'Lab Report 1', 45, 50, 'Term 1'),
('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'Lab Report 1', 38, 50, 'Term 1'),
('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000005', 'Lab Report 1', 42, 50, 'Term 1')
ON CONFLICT DO NOTHING;
