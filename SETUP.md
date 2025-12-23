# Popqiz Setup Guide

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- OpenAI API key

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API to get:
   - Project URL
   - `anon` public key
   - `service_role` secret key (keep this secret!)

3. Go to SQL Editor and run:
   - First, run the base schema from `supabase/schema.sql`
   - Then, run migrations in order (if you have an existing database):
     - `supabase/migration_add_source_and_variable_choices.sql` (adds source tracking and supports 2-4 answer choices)

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

### 4. Enable Realtime

In Supabase Dashboard:
1. Go to Database > Replication
2. Enable replication for tables: `rooms`, `players`, `answers`

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. (Optional) Seed Questions from OpenTDB

To seed your database with questions from Open Trivia Database (free, CC BY-SA 4.0 licensed):

**Option A: Use the API endpoint** (recommended for production)
```bash
# Seed questions for a specific age band and difficulty
curl -X POST http://localhost:3000/api/admin/seed-opentdb \
  -H "Content-Type: application/json" \
  -d '{"amount": 50, "difficulty": "easy", "ageBand": "kids"}'
```

**Option B: Use the bulk seeding script** (requires tsx)
```bash
# Install tsx if not already available
npm install -D tsx

# Run the seeding script (default: 2000 questions)
npx tsx scripts/seed-opentdb.ts

# Or specify a custom target count
TARGET_COUNT=5000 npx tsx scripts/seed-opentdb.ts
```

**Note:** 
- OpenTDB has a rate limit of 1 request per 5 seconds (automatically handled)
- Script uses session tokens to avoid getting duplicate questions from OpenTDB
- Questions are automatically deduplicated using question hashes
- Questions are filtered by quality score (minimum 50 for OpenTDB, vs 70 for OpenAI)
- Supports 2 choices (True/False), 3 choices, or 4 choices
- Questions include source attribution (`opentdb` or `openai`)
- Script will loop through different categories and difficulties to maximize variety
- Progress is shown in real-time with estimated completion percentage
- Script automatically stops when target count is reached or when it can't find more new questions

## Testing Multiplayer

1. Open the app in two different browser windows (or use incognito mode)
2. Create a room in one window
3. Join with the room code in the other window
4. Both should see the same question and updates in real-time!

## Known Limitations (MVP)

- Round progression uses client-side polling (host pings `/tick` every 2s)
- No persistent game history
- Questions are cached but not validated for quality beyond basic checks
- No rate limiting on API endpoints
- Device ID stored in localStorage (clears if cleared)

## Architecture Notes

- **Server Authoritative**: All scoring and round progression happens server-side
- **Real-time Updates**: Uses Supabase Realtime subscriptions (Postgres changes)
- **Question Caching**: Questions generated via OpenAI or seeded from OpenTDB, cached in `question_cache` table with source tracking
- **Round Loop**: Server advances rounds when time expires or all players answer

