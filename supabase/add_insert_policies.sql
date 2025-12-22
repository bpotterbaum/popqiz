-- Add INSERT policies for RLS-enabled tables
-- This allows inserts when using service role key

-- Allow inserts to rooms (for creating new rooms)
CREATE POLICY "Allow insert to rooms" ON rooms FOR INSERT WITH CHECK (true);

-- Allow inserts to players (for joining rooms)
CREATE POLICY "Allow insert to players" ON players FOR INSERT WITH CHECK (true);

-- Allow updates to players (for scoring)
CREATE POLICY "Allow update to players" ON players FOR UPDATE USING (true);

-- Allow inserts to answers
CREATE POLICY "Allow insert to answers" ON answers FOR INSERT WITH CHECK (true);

-- Allow updates to rooms (for advancing rounds)
CREATE POLICY "Allow update to rooms" ON rooms FOR UPDATE USING (true);

-- Allow inserts to question_feedback
CREATE POLICY "Allow insert to question_feedback" ON question_feedback FOR INSERT WITH CHECK (true);
