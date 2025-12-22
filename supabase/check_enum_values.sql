-- Check current enum values for team_color
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'team_color'::regtype
ORDER BY enumsortorder;
