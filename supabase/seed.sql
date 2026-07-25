-- Seed demo data for Edify International School
-- 
-- PREREQUISITE: Create auth users via Supabase Dashboard → Authentication → Users → Add user
-- Email format: firstname.lastname@edify.demo  Password: password123
-- Create these 9 users first, then run the SQL below.
--
-- Teachers:  sarah.jones@edify.demo, james.wilson@edify.demo
-- Students:  aisha.patel@edify.demo, omar.hassan@edify.demo, lily.chen@edify.demo,
--            rajan.sharma@edify.demo, emma.brown@edify.demo
-- Parents:   priya.patel@edify.demo, yusuf.hassan@edify.demo

-- STEP 1: Profiles
INSERT INTO public.profiles (id, school_id, role, full_name, email)
SELECT id, '11111111-1111-1111-1111-111111111111'::uuid, 'teacher', 'Sarah Jones', email FROM auth.users WHERE email = 'sarah.jones@edify.demo' ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, school_id, role, full_name, email)
SELECT id, '11111111-1111-1111-1111-111111111111'::uuid, 'teacher', 'James Wilson', email FROM auth.users WHERE email = 'james.wilson@edify.demo' ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, school_id, role, full_name, email)
SELECT id, '11111111-1111-1111-1111-111111111111'::uuid, 'student', 'Aisha Patel', email FROM auth.users WHERE email = 'aisha.patel@edify.demo' ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, school_id, role, full_name, email)
SELECT id, '11111111-1111-1111-1111-111111111111'::uuid, 'student', 'Omar Hassan', email FROM auth.users WHERE email = 'omar.hassan@edify.demo' ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, school_id, role, full_name, email)
SELECT id, '11111111-1111-1111-1111-111111111111'::uuid, 'student', 'Lily Chen', email FROM auth.users WHERE email = 'lily.chen@edify.demo' ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, school_id, role, full_name, email)
SELECT id, '11111111-1111-1111-1111-111111111111'::uuid, 'student', 'Rajan Sharma', email FROM auth.users WHERE email = 'rajan.sharma@edify.demo' ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, school_id, role, full_name, email)
SELECT id, '11111111-1111-1111-1111-111111111111'::uuid, 'student', 'Emma Brown', email FROM auth.users WHERE email = 'emma.brown@edify.demo' ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, school_id, role, full_name, email)
SELECT id, '11111111-1111-1111-1111-111111111111'::uuid, 'parent', 'Priya Patel', email FROM auth.users WHERE email = 'priya.patel@edify.demo' ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, school_id, role, full_name, email)
SELECT id, '11111111-1111-1111-1111-111111111111'::uuid, 'parent', 'Yusuf Hassan', email FROM auth.users WHERE email = 'yusuf.hassan@edify.demo' ON CONFLICT (id) DO NOTHING;

-- STEP 2: Enrollments
DELETE FROM public.class_enrollments;
INSERT INTO public.class_enrollments (class_id, student_id)
SELECT 'd1000000-0000-4000-8000-000000000001'::uuid, id FROM auth.users WHERE email IN ('aisha.patel@edify.demo','omar.hassan@edify.demo','lily.chen@edify.demo') ON CONFLICT DO NOTHING;
INSERT INTO public.class_enrollments (class_id, student_id)
SELECT 'd1000000-0000-4000-8000-000000000002'::uuid, id FROM auth.users WHERE email IN ('lily.chen@edify.demo','rajan.sharma@edify.demo','emma.brown@edify.demo') ON CONFLICT DO NOTHING;

-- STEP 3: Parent-student links
DELETE FROM public.parent_students;
INSERT INTO public.parent_students (parent_id, student_id)
SELECT p.id, s.id FROM auth.users p JOIN auth.users s ON 1=1 WHERE p.email = 'priya.patel@edify.demo' AND s.email = 'aisha.patel@edify.demo' ON CONFLICT DO NOTHING;
INSERT INTO public.parent_students (parent_id, student_id)
SELECT p.id, s.id FROM auth.users p JOIN auth.users s ON 1=1 WHERE p.email = 'yusuf.hassan@edify.demo' AND s.email = 'omar.hassan@edify.demo' ON CONFLICT DO NOTHING;

-- STEP 4: Attendance
DELETE FROM public.attendance_records;
INSERT INTO public.attendance_records (class_id, student_id, date, status)
SELECT 'd1000000-0000-4000-8000-000000000001'::uuid, id, current_date - 1, 'present' FROM auth.users WHERE email = 'aisha.patel@edify.demo'
UNION ALL SELECT 'd1000000-0000-4000-8000-000000000001'::uuid, id, current_date - 1, 'present' FROM auth.users WHERE email = 'omar.hassan@edify.demo'
UNION ALL SELECT 'd1000000-0000-4000-8000-000000000001'::uuid, id, current_date - 1, 'absent' FROM auth.users WHERE email = 'lily.chen@edify.demo'
UNION ALL SELECT 'd1000000-0000-4000-8000-000000000001'::uuid, id, current_date - 2, 'present' FROM auth.users WHERE email = 'aisha.patel@edify.demo'
UNION ALL SELECT 'd1000000-0000-4000-8000-000000000001'::uuid, id, current_date - 2, 'late' FROM auth.users WHERE email = 'omar.hassan@edify.demo'
UNION ALL SELECT 'd1000000-0000-4000-8000-000000000001'::uuid, id, current_date - 2, 'present' FROM auth.users WHERE email = 'lily.chen@edify.demo'
UNION ALL SELECT 'd1000000-0000-4000-8000-000000000002'::uuid, id, current_date - 1, 'present' FROM auth.users WHERE email = 'lily.chen@edify.demo'
UNION ALL SELECT 'd1000000-0000-4000-8000-000000000002'::uuid, id, current_date - 1, 'present' FROM auth.users WHERE email = 'rajan.sharma@edify.demo'
UNION ALL SELECT 'd1000000-0000-4000-8000-000000000002'::uuid, id, current_date - 1, 'present' FROM auth.users WHERE email = 'emma.brown@edify.demo';

-- STEP 5: Grades
DELETE FROM public.grade_entries;
INSERT INTO public.grade_entries (class_id, student_id, title, score, max_score, term)
SELECT 'd1000000-0000-4000-8000-000000000001'::uuid, id, 'Midterm Exam', 88, 100, 'Term 1' FROM auth.users WHERE email = 'aisha.patel@edify.demo'
UNION ALL SELECT 'd1000000-0000-4000-8000-000000000001'::uuid, id, 'Midterm Exam', 76, 100, 'Term 1' FROM auth.users WHERE email = 'omar.hassan@edify.demo'
UNION ALL SELECT 'd1000000-0000-4000-8000-000000000001'::uuid, id, 'Midterm Exam', 92, 100, 'Term 1' FROM auth.users WHERE email = 'lily.chen@edify.demo'
UNION ALL SELECT 'd1000000-0000-4000-8000-000000000002'::uuid, id, 'Lab Report 1', 45, 50, 'Term 1' FROM auth.users WHERE email = 'lily.chen@edify.demo'
UNION ALL SELECT 'd1000000-0000-4000-8000-000000000002'::uuid, id, 'Lab Report 1', 38, 50, 'Term 1' FROM auth.users WHERE email = 'rajan.sharma@edify.demo'
UNION ALL SELECT 'd1000000-0000-4000-8000-000000000002'::uuid, id, 'Lab Report 1', 42, 50, 'Term 1' FROM auth.users WHERE email = 'emma.brown@edify.demo';
