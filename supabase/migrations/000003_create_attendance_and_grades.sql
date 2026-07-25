-- Migration 000003: Create attendance and grades tables

-- Attendance records
create table public.attendance_records (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references public.classes(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  date date not null default current_date,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  marked_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  unique (class_id, student_id, date)
);

-- Grade entries
create table public.grade_entries (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references public.classes(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  score numeric not null,
  max_score numeric not null default 100,
  term text not null,
  entered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.attendance_records enable row level security;
alter table public.grade_entries enable row level security;

-- Policies for attendance_records
create policy "Teachers can manage attendance for their classes"
  on public.attendance_records for all
  using (class_id in (select id from public.classes where teacher_id = auth.uid()));

create policy "Students can view their own attendance"
  on public.attendance_records for select
  using (student_id = auth.uid());

create policy "Parents can view their children's attendance"
  on public.attendance_records for select
  using (student_id in (select student_id from public.parent_students where parent_id = auth.uid()));

-- Policies for grade_entries
create policy "Teachers can manage grades for their classes"
  on public.grade_entries for all
  using (class_id in (select id from public.classes where teacher_id = auth.uid()));

create policy "Students can view their own grades"
  on public.grade_entries for select
  using (student_id = auth.uid());

create policy "Parents can view their children's grades"
  on public.grade_entries for select
  using (student_id in (select student_id from public.parent_students where parent_id = auth.uid()));
