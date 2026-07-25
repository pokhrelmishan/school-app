-- Migration 000002: Create classes and enrollments tables

-- Classes table
create table public.classes (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  grade_level text not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Class enrollments table (junction)
create table public.class_enrollments (
  class_id uuid references public.classes(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  enrolled_at timestamptz default now(),
  primary key (class_id, student_id)
);

-- Parent-student link table
create table public.parent_students (
  parent_id uuid references public.profiles(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  primary key (parent_id, student_id)
);

-- Enable RLS
alter table public.classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.parent_students enable row level security;

-- Policies for classes
create policy "Teachers can view their own classes"
  on public.classes for select
  using (teacher_id = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin');

create policy "Students can view classes they are enrolled in"
  on public.classes for select
  using (id in (select class_id from public.class_enrollments where student_id = auth.uid()));

-- Policies for class_enrollments
create policy "Teachers can view enrollments for their classes"
  on public.class_enrollments for select
  using (class_id in (select id from public.classes where teacher_id = auth.uid()));

create policy "Students can view their own enrollments"
  on public.class_enrollments for select
  using (student_id = auth.uid());
