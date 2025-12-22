-- Migration: Add points tracking and answer timing
-- Run this to add support for time-based scoring

-- Add points column to answers table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'answers' AND column_name = 'points'
    ) THEN
        ALTER TABLE answers ADD COLUMN points INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'answers' AND column_name = 'answered_at'
    ) THEN
        ALTER TABLE answers ADD COLUMN answered_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_answers_answered_at ON answers(answered_at);
