-- Cleanup script to remove OpenTDB questions that may have incorrect difficulty mappings
-- Run this in Supabase SQL Editor before reseeding

-- First, delete references in related tables (to avoid foreign key constraint errors)
-- Delete answers that reference these questions
DELETE FROM answers 
WHERE question_id IN (
  SELECT id FROM question_cache 
  WHERE age_band = 'kids' 
    AND source = 'opentdb'
);

-- Delete room_questions entries that reference these questions
DELETE FROM room_questions 
WHERE question_id IN (
  SELECT id FROM question_cache 
  WHERE age_band = 'kids' 
    AND source = 'opentdb'
);

-- Delete question_feedback entries that reference these questions
DELETE FROM question_feedback 
WHERE question_id IN (
  SELECT id FROM question_cache 
  WHERE age_band = 'kids' 
    AND source = 'opentdb'
);

-- Now delete all OpenTDB questions for kids (should only be easy, but we can't tell which are wrong)
-- This allows you to reseed with only easy questions
DELETE FROM question_cache 
WHERE age_band = 'kids' 
  AND source = 'opentdb';

-- Optional: Also clean up other age bands if needed
-- Uncomment and run separately if you want to clean them too:

-- For tweens:
-- DELETE FROM answers 
-- WHERE question_id IN (SELECT id FROM question_cache WHERE age_band = 'tweens' AND source = 'opentdb');
-- DELETE FROM room_questions 
-- WHERE question_id IN (SELECT id FROM question_cache WHERE age_band = 'tweens' AND source = 'opentdb');
-- DELETE FROM question_feedback 
-- WHERE question_id IN (SELECT id FROM question_cache WHERE age_band = 'tweens' AND source = 'opentdb');
-- DELETE FROM question_cache 
-- WHERE age_band = 'tweens' AND source = 'opentdb';

-- For family:
-- DELETE FROM answers 
-- WHERE question_id IN (SELECT id FROM question_cache WHERE age_band = 'family' AND source = 'opentdb');
-- DELETE FROM room_questions 
-- WHERE question_id IN (SELECT id FROM question_cache WHERE age_band = 'family' AND source = 'opentdb');
-- DELETE FROM question_feedback 
-- WHERE question_id IN (SELECT id FROM question_cache WHERE age_band = 'family' AND source = 'opentdb');
-- DELETE FROM question_cache 
-- WHERE age_band = 'family' AND source = 'opentdb';

-- For adults:
-- DELETE FROM answers 
-- WHERE question_id IN (SELECT id FROM question_cache WHERE age_band = 'adults' AND source = 'opentdb');
-- DELETE FROM room_questions 
-- WHERE question_id IN (SELECT id FROM question_cache WHERE age_band = 'adults' AND source = 'opentdb');
-- DELETE FROM question_feedback 
-- WHERE question_id IN (SELECT id FROM question_cache WHERE age_band = 'adults' AND source = 'opentdb');
-- DELETE FROM question_cache 
-- WHERE age_band = 'adults' AND source = 'opentdb';

-- To delete ALL OpenTDB questions (all age bands):
-- DELETE FROM answers 
-- WHERE question_id IN (SELECT id FROM question_cache WHERE source = 'opentdb');
-- DELETE FROM room_questions 
-- WHERE question_id IN (SELECT id FROM question_cache WHERE source = 'opentdb');
-- DELETE FROM question_feedback 
-- WHERE question_id IN (SELECT id FROM question_cache WHERE source = 'opentdb');
-- DELETE FROM question_cache 
-- WHERE source = 'opentdb';

-- After running this, reseed questions using the seeding script
-- The updated code will now properly validate difficulty before caching

