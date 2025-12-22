-- First, check what enum values currently exist
SELECT enumlabel as current_values
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'team_color')
ORDER BY enumsortorder;

-- Then run each ALTER TYPE statement below individually
-- Run them one at a time, and if you get an error that the value already exists, 
-- that's fine - just continue with the next one

-- Add missing enum values (run these individually):
ALTER TYPE team_color ADD VALUE 'yellow';
ALTER TYPE team_color ADD VALUE 'teal';
ALTER TYPE team_color ADD VALUE 'red';
ALTER TYPE team_color ADD VALUE 'orange';
ALTER TYPE team_color ADD VALUE 'light-blue';
ALTER TYPE team_color ADD VALUE 'pink';
ALTER TYPE team_color ADD VALUE 'lime';
ALTER TYPE team_color ADD VALUE 'white';

-- After running the above, verify all values exist:
SELECT enumlabel as all_enum_values
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'team_color')
ORDER BY enumsortorder;
