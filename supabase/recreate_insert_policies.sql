-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow insert to players" ON players;
DROP POLICY IF EXISTS "Allow update to players" ON players;
DROP POLICY IF EXISTS "Allow insert to answers" ON answers;
DROP POLICY IF EXISTS "Allow update to rooms" ON rooms;
DROP POLICY IF EXISTS "Allow insert to question_feedback" ON question_feedback;
DROP POLICY IF EXISTS "Allow insert to rooms" ON rooms;

-- Recreate policies
CREATE POLICY "Allow insert to rooms" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow insert to players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update to players" ON players FOR UPDATE USING (true);
CREATE POLICY "Allow insert to answers" ON answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update to rooms" ON rooms FOR UPDATE USING (true);
CREATE POLICY "Allow insert to question_feedback" ON question_feedback FOR INSERT WITH CHECK (true);
