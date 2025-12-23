// Load environment variables FIRST, before any other imports
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

// Parse .env.local file and load into process.env
const envPath = resolve(process.cwd(), '.env.local');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '').trim();
        if (key && cleanValue) {
          process.env[key.trim()] = cleanValue;
        }
      }
    }
  });
} catch (error) {
  console.error('❌ Error: Could not load .env.local file.');
  console.error('   Make sure .env.local exists in the project root with your Supabase credentials.');
  console.error('   See SETUP.md for instructions on creating .env.local');
  process.exit(1);
}

async function main() {
  // Get count from environment variable (defaults to 30 for testing)
  const COUNT = process.env.SEED_ALL_COUNT ? parseInt(process.env.SEED_ALL_COUNT, 10) : 30;

  console.log('🌱 Starting seeding for all age bands...');
  console.log(`   Count per age band: ${COUNT}\n`);
  console.log('='.repeat(60));
  console.log('');

  try {
    // 1. Seed Kids (AI-generated)
    console.log('1️⃣  Seeding KIDS (AI-generated)...');
    console.log('-'.repeat(60));
    execSync(`AI_KIDS_COUNT=${COUNT} npx tsx scripts/seed-ai-kids.ts`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('✅ Kids seeding complete\n');
    console.log('');

    // 2. Seed Tweens (AI-generated)
    console.log('2️⃣  Seeding TWEENS (AI-generated)...');
    console.log('-'.repeat(60));
    execSync(`AI_TWEENS_COUNT=${COUNT} npx tsx scripts/seed-ai-tweens.ts`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('✅ Tweens seeding complete\n');
    console.log('');

    // 3. Seed Adults (OpenTDB)
    console.log('3️⃣  Seeding ADULTS (OpenTDB)...');
    console.log('-'.repeat(60));
    execSync(`TARGET_COUNT=${COUNT} npx tsx scripts/seed-opentdb.ts`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('✅ Adults seeding complete\n');
    console.log('');

    // 4. Seed Family (blend from kids, tweens, adults)
    console.log('4️⃣  Seeding FAMILY (blend from kids, tweens, adults)...');
    console.log('-'.repeat(60));
    execSync(`FAMILY_TOTAL_COUNT=${COUNT} npx tsx scripts/seed-family-from-kids-tweens.ts`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('✅ Family seeding complete\n');
    console.log('');

    console.log('='.repeat(60));
    console.log('🎉 All seeding complete!');
    console.log(`   • Kids: ${COUNT} questions`);
    console.log(`   • Tweens: ${COUNT} questions`);
    console.log(`   • Adults: ${COUNT} questions`);
    console.log(`   • Family: ${COUNT} questions (blended)`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Seeding failed at one of the steps:', error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Seed all failed:', err);
  process.exit(1);
});

