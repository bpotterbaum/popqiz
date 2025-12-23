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
  const { cacheQuestions } = await import('../lib/questions');

  console.log('🧪 Inserting test questions...\n');

  // Test question 1: True/False (2 choices)
  const trueFalseQuestion = {
    question: 'This is a True/False test question. The answer is True.',
    choices: ['True', 'False'],
    correct_index: 0,
    source: 'opentdb' as const,
  };

  // Test question 2: 4 choices
  const fourChoiceQuestion = {
    question: 'This is a test question with 4 answer choices. Which is correct?',
    choices: ['First choice (wrong)', 'Second choice (correct)', 'Third choice (wrong)', 'Fourth choice (wrong)'],
    correct_index: 1,
    source: 'opentdb' as const,
  };

  // Test question 3: 3 choices (for comparison)
  const threeChoiceQuestion = {
    question: 'This is a test question with 3 answer choices. Which is correct?',
    choices: ['First choice (wrong)', 'Second choice (correct)', 'Third choice (wrong)'],
    correct_index: 1,
    source: 'opentdb' as const,
  };

  const ageBands = ['kids', 'tweens', 'family', 'adults'] as const;

  for (const ageBand of ageBands) {
    console.log(`Inserting test questions for ${ageBand}...`);
    
    try {
      await cacheQuestions(ageBand, [trueFalseQuestion], { 
        minQualityScore: 0, // Bypass quality filter for test questions
        source: 'opentdb'
      });
      console.log(`  ✓ Inserted True/False question`);

      await cacheQuestions(ageBand, [fourChoiceQuestion], { 
        minQualityScore: 0,
        source: 'opentdb'
      });
      console.log(`  ✓ Inserted 4-choice question`);

      await cacheQuestions(ageBand, [threeChoiceQuestion], { 
        minQualityScore: 0,
        source: 'opentdb'
      });
      console.log(`  ✓ Inserted 3-choice question`);
    } catch (error) {
      console.error(`  ✗ Error inserting questions for ${ageBand}:`, error);
    }
  }

  console.log('\n✅ Test questions inserted!');
  console.log('\nTo test in the UI:');
  console.log('\nOption 1: Test directly via API endpoint');
  console.log('  Visit in your browser:');
  console.log('    - http://localhost:3000/api/test-questions?type=2  (True/False)');
  console.log('    - http://localhost:3000/api/test-questions?type=3  (3 choices)');
  console.log('    - http://localhost:3000/api/test-questions?type=4  (4 choices)');
  console.log('\nOption 2: Test in a real room');
  console.log('  1. Create a new room with any age band');
  console.log('  2. The questions should appear in your question pool');
  console.log('  3. Look for:');
  console.log('     - "This is a True/False test question..." (2 choices)');
  console.log('     - "This is a test question with 4 answer choices..." (4 choices)');
  console.log('     - "This is a test question with 3 answer choices..." (3 choices)');
  console.log('\n  Note: Questions are selected randomly, so you may need to refresh/retry a few times.');
}

main().catch(console.error);

