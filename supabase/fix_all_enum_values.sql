-- Add all missing enum values to team_color enum
-- This ensures all values from the code are available in the database

DO $$ 
DECLARE
    expected_values TEXT[] := ARRAY['yellow', 'teal', 'red', 'orange', 'light-blue', 'pink', 'lime', 'white'];
    val TEXT;
BEGIN
    FOREACH val IN ARRAY expected_values
    LOOP
        -- Check if the value exists, if not add it
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = val 
            AND enumtypid = 'team_color'::regtype
        ) THEN
            BEGIN
                ALTER TYPE team_color ADD VALUE val;
                RAISE NOTICE 'Added enum value: %', val;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not add enum value % (may already exist): %', val, SQLERRM;
            END;
        END IF;
    END LOOP;
END $$;

-- Verify all enum values exist
SELECT enumlabel as current_enum_values
FROM pg_enum 
WHERE enumtypid = 'team_color'::regtype
ORDER BY enumsortorder;
