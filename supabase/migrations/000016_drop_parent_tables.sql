-- Migration 000016: Drop unused parent-related tables and functions

DROP TABLE IF EXISTS parent_students CASCADE;
DROP FUNCTION IF EXISTS is_parent_of_student(uuid);
