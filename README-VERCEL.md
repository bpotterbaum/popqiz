# Deploying to Vercel

## Quick Start

### 1. Set up Environment Variables

**Option A: Use the automated script (easiest)**
```bash
# Make sure you have .env.local with your actual values
cp .env.local.example .env.local
# Edit .env.local with your real values

# Then run the script to add to Vercel
./vercel-env-setup.sh
```

**Option B: Manual upload via Vercel Dashboard**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings > Environment Variables
4. Add each variable from `.env.local.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`

### 2. Deploy

**Via Vercel Dashboard:**
- Connect your GitHub repo at https://vercel.com/new
- Vercel will auto-detect Next.js
- Deploy!

**Via CLI:**
```bash
npx vercel login
npx vercel --prod
```

## Environment Variables Reference

See `.env.local.example` for the template with all required variables.

See `.vercel-env-vars.md` for detailed instructions.
