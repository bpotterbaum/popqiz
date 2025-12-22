-- Add all required enum values to team_color
-- PostgreSQL doesn't support IF NOT EXISTS for ALTER TYPE ADD VALUE
-- So we check if each value exists before adding it

DO $$ 
DECLARE
    val TEXT;
    expected_values TEXT[] := ARRAY['yellow', 'teal', 'red', 'orange', 'light-blue', 'pink', 'lime', 'white'];
BEGIN
    FOREACH val IN ARRAY expected_values
    LOOP
        -- Check if the value exists before trying to add it
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = val 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'team_color')
        ) THEN
            EXECUTE format('ALTER TYPE team_color ADD VALUE %L', val);
            RAISE NOTICE 'Added enum value: %', val;
        ELSE
            RAISE NOTICE 'Enum value % already exists, skipping', val;
        END IF;
    END LOOP;
END $$;

-- Verify all enum values
SELECT enumlabel as enum_value
FROM pg_enum 
WHERE enumtypid = 'team_color'::regtype
ORDER BY enumsortorder;
