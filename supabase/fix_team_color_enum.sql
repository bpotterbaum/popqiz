-- Add missing enum values to team_color
-- PostgreSQL doesn't allow removing enum values, but we can add missing ones

-- Add 'pink' if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'pink' 
        AND enumtypid = 'team_color'::regtype
    ) THEN
        ALTER TYPE team_color ADD VALUE 'pink';
    END IF;
END $$;

-- Check current enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'team_color'::regtype
ORDER BY enumsortorder;
