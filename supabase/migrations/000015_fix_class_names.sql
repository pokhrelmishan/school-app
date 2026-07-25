-- Fix: Rename subject-named classes to proper class names
-- and assign correct class teachers

-- First, let's see what we have
-- UPDATE the existing classes to have proper names

-- Rename "Mathematics" class → "Grade 5"
UPDATE classes SET name = 'Grade 5', grade_level = '5' 
WHERE name = 'Mathematics';

-- Rename "Science" class → "Grade 10"  
UPDATE classes SET name = 'Grade 10', grade_level = '10'
WHERE name = 'Science';

-- Sarah (20c9e62b...) should be class teacher of Grade 5
UPDATE classes SET teacher_id = '20c9e62b-e2b3-4fb2-8042-b35198b9f267'
WHERE name = 'Grade 5';

-- James (f3edb201...) should be class teacher of Grade 10
UPDATE classes SET teacher_id = 'f3edb201-75fe-49f5-9f8a-3583b7eba20e'
WHERE name = 'Grade 10';

-- Verify
SELECT c.name, c.grade_level, p.full_name as teacher
FROM classes c
LEFT JOIN profiles p ON c.teacher_id = p.id;
