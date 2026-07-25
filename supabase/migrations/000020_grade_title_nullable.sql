-- Migration 000020: Make title nullable in grade_entries

ALTER TABLE grade_entries ALTER COLUMN title DROP NOT NULL;
ALTER TABLE grade_entries ALTER COLUMN score DROP NOT NULL;
ALTER TABLE grade_entries ALTER COLUMN max_score DROP NOT NULL;
