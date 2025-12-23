// Load environment variables FIRST, before any other imports
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env.local file and load into process.env
const envPath = resolve(process.cwd(), '.env.local');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
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
  process.exit(1);
}

// Dynamically import after env vars are loaded
async function main() {
  const { createServerClient } = await import('../lib/supabase');
  const supabase = createServerClient();

  console.log('🧹 Cleaning up incorrectly mapped questions...\n');

  // Define correct difficulty mappings
  const difficultyMappings = {
    kids: { allowedDifficulties: ['easy'], description: 'easy only' },
    tweens: { allowedDifficulties: ['easy', 'medium'], description: 'easy and medium' },
    family: { allowedDifficulties: ['easy', 'medium'], description: 'easy and medium' },
    adults: { allowedDifficulties: ['medium', 'hard'], description: 'medium and hard' },
  };

  // Since we don't store difficulty in the database, we can't directly filter
  // Instead, we'll need to rely on the source or create a manual cleanup
  // For now, let's just show what's in the database and suggest reseeding
  
  console.log('📊 Checking question counts by age band and source...\n');

  const ageBands = ['kids', 'tweens', 'family', 'adults'] as const;
  
  for (const ageBand of ageBands) {
    const { data, error } = await supabase
      .from('question_cache')
      .select('id, question, source, choices')
      .eq('age_band', ageBand)
      .limit(1000);

    if (error) {
      console.error(`Error querying ${ageBand}:`, error);
      continue;
    }

    const count = data?.length || 0;
    const opentdbCount = data?.filter(q => q.source === 'opentdb').length || 0;
    const openaiCount = data?.filter(q => q.source === 'openai').length || 0;
    
    console.log(`${ageBand}:`);
    console.log(`  Total: ${count}`);
    console.log(`  OpenTDB: ${opentdbCount}`);
    console.log(`  OpenAI: ${openaiCount}`);
    console.log(`  Expected difficulty: ${difficultyMappings[ageBand].description}`);
    console.log('');
  }

  console.log('💡 Note: Since difficulty is not stored in the database,');
  console.log('   we cannot automatically detect incorrectly mapped questions.');
  console.log('');
  console.log('🔧 Solution: Reseed questions with the updated validation logic.');
  console.log('   The updated code now validates difficulty before caching.');
  console.log('');
  console.log('   To reseed kids questions (easy only):');
  console.log('   TARGET_COUNT=500 npx tsx scripts/seed-opentdb.ts');
  console.log('');
  console.log('   Or manually delete OpenTDB questions for kids and reseed:');
  console.log('   (This would require running SQL in Supabase)');
}

main().catch(console.error);

