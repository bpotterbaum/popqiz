-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Age band enum
CREATE TYPE age_band AS ENUM ('kids', 'tweens', 'family', 'adults');

-- Room status enum
CREATE TYPE room_status AS ENUM ('active', 'ended');

-- Feedback type enum
CREATE TYPE feedback_type AS ENUM ('skip', 'inappropriate', 'confusing');

-- Team color enum
CREATE TYPE team_color AS ENUM ('yellow', 'teal', 'red', 'orange', 'light-blue', 'pink', 'lime', 'white');

-- Rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  age_band age_band NOT NULL,
  status room_status DEFAULT 'active',
  round_number INTEGER DEFAULT 1,
  current_question_id UUID,
  round_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  team_color team_color NOT NULL,
  score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, device_id)
);

-- Question cache table
CREATE TABLE question_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  age_band age_band NOT NULL,
  question TEXT NOT NULL,
  -- Normalized hash for de-duping questions per age band
  question_hash TEXT,
  choices JSONB NOT NULL, -- array of 3 strings
  correct_index INTEGER NOT NULL CHECK (correct_index >= 0 AND correct_index <= 2),
  explanation TEXT,
  quality_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate questions per age band (best-effort; allows nulls if backfilled later)
CREATE UNIQUE INDEX IF NOT EXISTS idx_question_cache_age_hash_unique
  ON question_cache(age_band, question_hash)
  WHERE question_hash IS NOT NULL;

-- Track which questions have been served per room/round to avoid repeats within a session.
CREATE TABLE room_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  question_id UUID NOT NULL REFERENCES question_cache(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, round_number),
  UNIQUE(room_id, question_id)
);

-- Answers table
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  question_id UUID NOT NULL REFERENCES question_cache(id),
  answer_index INTEGER NOT NULL CHECK (answer_index >= 0 AND answer_index <= 2),
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, player_id, round_number)
);

-- Question feedback table
CREATE TABLE question_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES question_cache(id),
  feedback_type feedback_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_answers_room_id ON answers(room_id);
CREATE INDEX idx_answers_room_round ON answers(room_id, round_number);
CREATE INDEX idx_question_cache_age_band ON question_cache(age_band);
CREATE INDEX idx_question_feedback_question_id ON question_feedback(question_id);
CREATE INDEX idx_room_questions_room_id ON room_questions(room_id);
CREATE INDEX idx_room_questions_room_round ON room_questions(room_id, round_number);

-- Row Level Security (RLS) policies
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_questions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to rooms (for joining)
CREATE POLICY "Anyone can read rooms" ON rooms FOR SELECT USING (true);

-- Allow public read access to players in a room
CREATE POLICY "Anyone can read players in rooms" ON players FOR SELECT USING (true);

-- Allow public read access to answers in a room
CREATE POLICY "Anyone can read answers in rooms" ON answers FOR SELECT USING (true);

-- Allow public read access to question cache
CREATE POLICY "Anyone can read question cache" ON question_cache FOR SELECT USING (true);

-- Allow public read access to room_questions (for clients that may want to show history later)
CREATE POLICY "Anyone can read room_questions" ON room_questions FOR SELECT USING (true);

-- Allow service role to insert/update (via API routes)
-- Note: In production, you'd want more restrictive policies
-- For MVP, we'll handle auth in API routes

-- Allow inserts to rooms (for creating new rooms)
CREATE POLICY "Allow insert to rooms" ON rooms FOR INSERT WITH CHECK (true);

-- Allow inserts to players (for joining rooms)
CREATE POLICY "Allow insert to players" ON players FOR INSERT WITH CHECK (true);

-- Allow updates to players (for scoring)
CREATE POLICY "Allow update to players" ON players FOR UPDATE USING (true);

-- Allow inserts to answers
CREATE POLICY "Allow insert to answers" ON answers FOR INSERT WITH CHECK (true);

-- Allow inserts to question_feedback
CREATE POLICY "Allow insert to question_feedback" ON question_feedback FOR INSERT WITH CHECK (true);

-- Allow inserts to room_questions (server records questions served)
CREATE POLICY "Allow insert to room_questions" ON room_questions FOR INSERT WITH CHECK (true);

-- Allow deletes from room_questions (for reset/new game)
CREATE POLICY "Allow delete from room_questions" ON room_questions FOR DELETE USING (true);

-- Enable Realtime for tables (must be done after tables are created)
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE answers;

