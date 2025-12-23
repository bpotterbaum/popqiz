-- Delete all questions from the question_cache table
-- This will clear all cached questions so you can start fresh with new seeds
-- NOTE: Must delete from dependent tables first due to foreign key constraints
-- Tables that reference question_cache: answers, question_feedback, room_questions

-- Delete from all dependent tables first (in any order since they don't reference each other)
DELETE FROM answers;
DELETE FROM question_feedback;
DELETE FROM room_questions;

-- Now safe to delete all questions from question_cache
DELETE FROM question_cache;

-- Verify deletion (should return 0)
SELECT COUNT(*) as remaining_questions FROM question_cache;

