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
  const { createServerClient } = await import('../lib/supabase');
  const { cacheQuestions } = await import('../lib/questions');
  
  const supabase = createServerClient();

  // Default total count: 30 (for testing, like other scripts)
  const TOTAL_COUNT = process.env.FAMILY_TOTAL_COUNT ? parseInt(process.env.FAMILY_TOTAL_COUNT, 10) : 30;

  // Calculate blend: 35% kids, 40% tweens (favored), 25% adults
  const KIDS_COUNT = Math.round(TOTAL_COUNT * 0.35);
  const TWEENS_COUNT = Math.round(TOTAL_COUNT * 0.40);
  const ADULTS_COUNT = TOTAL_COUNT - KIDS_COUNT - TWEENS_COUNT; // Remaining for adults

  console.log('🚀 Starting family seeding from kids, tweens, and adults...');
  console.log(`   Total target: ${TOTAL_COUNT} questions`);
  console.log(`   Blend: ${KIDS_COUNT} from kids (35%) + ${TWEENS_COUNT} from tweens (40%) + ${ADULTS_COUNT} from adults (25%)\n`);

  let totalSeeded = 0;

  // Fetch and copy questions from kids
  console.log(`📚 Fetching ${KIDS_COUNT} questions from kids...`);
  const { data: kidsQuestions, error: kidsError } = await supabase
    .from('question_cache')
    .select('question, choices, correct_index, explanation, source')
    .eq('age_band', 'kids')
    .order('quality_score', { ascending: false })
    .limit(KIDS_COUNT);

  if (kidsError) {
    console.error('❌ Error fetching kids questions:', kidsError);
    process.exit(1);
  }

  if (!kidsQuestions || kidsQuestions.length === 0) {
    console.warn('⚠️  No kids questions found. Make sure you have seeded kids questions first.');
  } else {
    console.log(`   Found ${kidsQuestions.length} kids questions`);
    
    const questionsToCache = kidsQuestions.map(q => ({
      question: q.question,
      choices: q.choices as string[],
      correct_index: q.correct_index,
      explanation: q.explanation || undefined,
      source: (q.source as 'openai' | 'opentdb') || 'openai',
    }));

    await cacheQuestions('family', questionsToCache, { minQualityScore: 70, source: 'openai' });
    totalSeeded += questionsToCache.length;
    console.log(`   ✅ Cached ${questionsToCache.length} questions from kids to family`);
  }

  // Fetch and copy questions from tweens
  console.log(`\n📚 Fetching ${TWEENS_COUNT} questions from tweens...`);
  const { data: tweensQuestions, error: tweensError } = await supabase
    .from('question_cache')
    .select('question, choices, correct_index, explanation, source')
    .eq('age_band', 'tweens')
    .order('quality_score', { ascending: false })
    .limit(TWEENS_COUNT);

  if (tweensError) {
    console.error('❌ Error fetching tweens questions:', tweensError);
    process.exit(1);
  }

  if (!tweensQuestions || tweensQuestions.length === 0) {
    console.warn('⚠️  No tweens questions found. Make sure you have seeded tweens questions first.');
  } else {
    console.log(`   Found ${tweensQuestions.length} tweens questions`);
    
    const questionsToCache = tweensQuestions.map(q => ({
      question: q.question,
      choices: q.choices as string[],
      correct_index: q.correct_index,
      explanation: q.explanation || undefined,
      source: (q.source as 'openai' | 'opentdb') || 'openai',
    }));

    await cacheQuestions('family', questionsToCache, { minQualityScore: 70, source: 'openai' });
    totalSeeded += questionsToCache.length;
    console.log(`   ✅ Cached ${questionsToCache.length} questions from tweens to family`);
  }

  // Fetch and copy questions from adults (OpenTDB - easy/medium difficulty)
  console.log(`\n📚 Fetching ${ADULTS_COUNT} questions from adults...`);
  const { data: adultsQuestions, error: adultsError } = await supabase
    .from('question_cache')
    .select('question, choices, correct_index, explanation, source')
    .eq('age_band', 'adults')
    .order('quality_score', { ascending: false })
    .limit(ADULTS_COUNT);

  if (adultsError) {
    console.error('❌ Error fetching adults questions:', adultsError);
    process.exit(1);
  }

  if (!adultsQuestions || adultsQuestions.length === 0) {
    console.warn('⚠️  No adults questions found. Make sure you have seeded adults questions (OpenTDB) first.');
  } else {
    console.log(`   Found ${adultsQuestions.length} adults questions`);
    
    const questionsToCache = adultsQuestions.map(q => ({
      question: q.question,
      choices: q.choices as string[],
      correct_index: q.correct_index,
      explanation: q.explanation || undefined,
      source: (q.source as 'openai' | 'opentdb') || 'opentdb',
    }));

    await cacheQuestions('family', questionsToCache, { minQualityScore: 70, source: 'opentdb' });
    totalSeeded += questionsToCache.length;
    console.log(`   ✅ Cached ${questionsToCache.length} questions from adults to family`);
  }

  console.log(`\n✅ Family seeding complete! Total: ${totalSeeded} questions cached for family.`);
  console.log(`   Note: Duplicates are automatically handled (same question won't be added twice).`);
}

main().catch((err) => {
  console.error('❌ Seed family failed:', err);
  process.exit(1);
});

