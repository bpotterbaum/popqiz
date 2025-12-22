#!/bin/bash

# Script to add environment variables to Vercel from .env.local
# Usage: ./vercel-env-setup.sh

if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local file not found!"
  echo "📝 Copy .env.local.example to .env.local and fill in your values first."
  exit 1
fi

echo "🚀 Adding environment variables to Vercel..."
echo ""

# Source the .env.local file
set -a
source .env.local
set +a

# Add each environment variable to Vercel
if [ ! -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "Adding NEXT_PUBLIC_SUPABASE_URL..."
  npx vercel env add NEXT_PUBLIC_SUPABASE_URL production preview development <<< "$NEXT_PUBLIC_SUPABASE_URL"
fi

if [ ! -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "Adding NEXT_PUBLIC_SUPABASE_ANON_KEY..."
  npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production preview development <<< "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
fi

if [ ! -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Adding SUPABASE_SERVICE_ROLE_KEY..."
  npx vercel env add SUPABASE_SERVICE_ROLE_KEY production preview development <<< "$SUPABASE_SERVICE_ROLE_KEY"
fi

if [ ! -z "$OPENAI_API_KEY" ]; then
  echo "Adding OPENAI_API_KEY..."
  npx vercel env add OPENAI_API_KEY production preview development <<< "$OPENAI_API_KEY"
fi

echo ""
echo "✅ Environment variables added to Vercel!"
echo "🔄 You may need to redeploy your project for changes to take effect."
