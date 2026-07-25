-- Migration 000001: Create schools and profiles tables

create extension if not exists "uuid-ossp";

-- Schools table
create table public.schools (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now()
);

-- Profiles table extending auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  role text not null check (role in ('admin', 'teacher', 'student', 'parent')),
  full_name text not null,
  email text not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.schools enable row level security;
alter table public.profiles enable row level security;

-- Policies for schools
create policy "Users can view their school"
  on public.schools for select
  using (id in (select school_id from public.profiles where id = auth.uid()));

-- Policies for profiles
create policy "Users can view profiles in their school"
  on public.profiles for select
  using (school_id in (select school_id from public.profiles where id = auth.uid()));
