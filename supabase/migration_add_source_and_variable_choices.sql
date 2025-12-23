-- Migration: Add source tracking and support 2-4 choices
-- This migration adds a source column to track question origin (opentdb vs openai)
-- and updates constraints to support 2-4 answer choices (True/False, 3-choice, or 4-choice)

-- Create source enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_source') THEN
        CREATE TYPE question_source AS ENUM ('opentdb', 'openai');
    END IF;
END $$;

-- Add source column to question_cache
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'question_cache' AND column_name = 'source'
    ) THEN
        ALTER TABLE question_cache ADD COLUMN source question_source DEFAULT 'openai';
    END IF;
END $$;

-- Update correct_index constraint to allow 0-3 (for 2, 3, or 4 choices)
ALTER TABLE question_cache 
  DROP CONSTRAINT IF EXISTS question_cache_correct_index_check;

ALTER TABLE question_cache 
  ADD CONSTRAINT question_cache_correct_index_check 
  CHECK (correct_index >= 0 AND correct_index <= 3);

-- Update answer_index constraint to allow 0-3
ALTER TABLE answers 
  DROP CONSTRAINT IF EXISTS answers_answer_index_check;

ALTER TABLE answers 
  ADD CONSTRAINT answers_answer_index_check 
  CHECK (answer_index >= 0 AND answer_index <= 3);

-- Update comment on choices column to reflect variable length
COMMENT ON COLUMN question_cache.choices IS 'JSONB array of 2-4 strings (True/False=2, Multiple=3 or 4)';

