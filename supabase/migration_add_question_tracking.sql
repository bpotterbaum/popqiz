-- Migration: Add question tracking and deduplication
-- Run this instead of the full schema.sql if you already have the base schema

-- Add question_hash column to question_cache (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'question_cache' AND column_name = 'question_hash'
    ) THEN
        ALTER TABLE question_cache ADD COLUMN question_hash TEXT;
    END IF;
END $$;

-- Create unique index for deduplication (if it doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS idx_question_cache_age_hash_unique
  ON question_cache(age_band, question_hash)
  WHERE question_hash IS NOT NULL;

-- Create room_questions table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS room_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  question_id UUID NOT NULL REFERENCES question_cache(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, round_number),
  UNIQUE(room_id, question_id)
);

-- Create indexes for room_questions (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_room_questions_room_id ON room_questions(room_id);
CREATE INDEX IF NOT EXISTS idx_room_questions_room_round ON room_questions(room_id, round_number);

-- Enable RLS on room_questions (if not already enabled)
ALTER TABLE room_questions ENABLE ROW LEVEL SECURITY;

-- Create policies for room_questions (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can read room_questions" ON room_questions;
CREATE POLICY "Anyone can read room_questions" ON room_questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert to room_questions" ON room_questions;
CREATE POLICY "Allow insert to room_questions" ON room_questions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete from room_questions" ON room_questions;
CREATE POLICY "Allow delete from room_questions" ON room_questions FOR DELETE USING (true);
