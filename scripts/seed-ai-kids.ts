// Load environment variables FIRST, before any other imports
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

// Dynamically import after env vars are loaded
async function main() {
  // Import after env vars are set
  const { generateKidsAIQuestions, cacheQuestions } = await import('../lib/questions');

  const COUNT = process.env.AI_KIDS_COUNT ? parseInt(process.env.AI_KIDS_COUNT, 10) : 30; // small batch to test
  const MIN_QUALITY = 75; // stricter for kids

  console.log('🚀 Starting AI seeding for kids...');
  console.log(`   Target: ${COUNT} questions`);
  console.log(`   Min quality score: ${MIN_QUALITY}`);

  const questions = await generateKidsAIQuestions(COUNT);
  console.log(`   Generated: ${questions.length} candidates`);

  if (questions.length === 0) {
    console.warn('⚠️  No questions generated. Check OpenAI API key and prompts.');
    return;
  }

  await cacheQuestions('kids', questions, { minQualityScore: MIN_QUALITY, source: 'openai' });
  console.log('✅ Seeding complete for kids (AI-generated).');
}

main().catch((err) => {
  console.error('❌ Seed AI kids failed:', err);
  process.exit(1);
});

