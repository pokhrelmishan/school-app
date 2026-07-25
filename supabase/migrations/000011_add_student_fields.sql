-- Migration 000011: Add student-specific fields to profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grade_level text,
  ADD COLUMN IF NOT EXISTS roll_number text,
  ADD COLUMN IF NOT EXISTS house text;
