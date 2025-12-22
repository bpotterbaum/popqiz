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

3. Go to SQL Editor and run the schema from `supabase/schema.sql`

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
- **Question Caching**: Questions generated via OpenAI and cached in `question_cache` table
- **Round Loop**: Server advances rounds when time expires or all players answer

