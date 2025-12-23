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
  const { seedFromOpenTDB, getOpenTDBSessionToken } = await import('../lib/questions');
  
  // Configuration
  const TARGET_COUNT = process.env.TARGET_COUNT ? parseInt(process.env.TARGET_COUNT) : 30; // Default 30 questions for testing
  const RATE_LIMIT_MS = 6000; // 6 seconds (5s limit + 1s buffer)
  
  console.log('🚀 Starting OpenTDB bulk seeding for ADULTS ONLY...');
  console.log(`   Target: ${TARGET_COUNT} new questions`);
  console.log(`   Rate limit: ${RATE_LIMIT_MS / 1000}s between requests\n`);
  console.log('   Note: OpenTDB is only used for adults. Kids and tweens use AI-generated questions.\n');
  
  const ageBands = ['adults'] as const;
  
  let totalSeeded = 0;
  let totalErrors = 0;
  let requestsMade = 0;
  const startTime = Date.now();

  // OpenTDB categories (some popular ones for variety)
  // See: https://opentdb.com/api_category.php
  const categories = [
    undefined, // Any category
    9,  // General Knowledge
    10, // Entertainment: Books
    11, // Entertainment: Film
    12, // Entertainment: Music
    17, // Science & Nature
    18, // Science: Computers
    22, // Geography
    23, // History
  ];

  for (const ageBand of ageBands) {
    console.log(`\n📚 Seeding ${ageBand}...`);
    
    // Adults only - use easy and medium difficulty (hard is too difficult)
    const relevantDifficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium'];

    for (const difficulty of relevantDifficulties) {
      // Get a new session token for each difficulty to maximize variety
      let sessionToken: string | undefined;
      try {
        sessionToken = await getOpenTDBSessionToken();
        console.log(`  📝 Got session token for ${difficulty} difficulty`);
      } catch (error) {
        console.warn(`  ⚠️  Could not get session token, continuing without it:`, error);
      }

      let consecutiveEmptyBatches = 0;
      const maxEmptyBatches = 3; // Stop if we get 3 empty batches in a row

      // Loop through categories for variety
      for (const category of categories) {
        if (totalSeeded >= TARGET_COUNT) {
          console.log(`\n✅ Reached target count of ${TARGET_COUNT} questions!`);
          break;
        }

        console.log(`  🔄 Fetching ${difficulty} questions${category ? ` (category ${category})` : ' (all categories)'}...`);
        
        // Rate limit: wait between requests
        if (requestsMade > 0) {
          process.stdout.write(`  ⏳ Waiting ${RATE_LIMIT_MS / 1000}s (rate limit)...`);
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
          process.stdout.write('\r' + ' '.repeat(50) + '\r'); // Clear line
        }

        try {
          requestsMade++;
          const result = await seedFromOpenTDB({
            amount: 50,
            difficulty,
            ageBand,
            category,
            token: sessionToken,
          });
          
          totalSeeded += result.seeded;
          totalErrors += result.errors;
          
          const progress = ((totalSeeded / TARGET_COUNT) * 100).toFixed(1);
          console.log(`  ✓ Seeded ${result.seeded} new, ${result.errors} skipped/errors | Total: ${totalSeeded}/${TARGET_COUNT} (${progress}%)`);
          
          // Handle token exhaustion (null means exhausted, undefined means no token was used)
          if (result.token === null && sessionToken) {
            // Token exhausted, get a new one
            try {
              sessionToken = await getOpenTDBSessionToken();
              console.log(`  🔄 Session token exhausted, got new token`);
            } catch (tokenError) {
              console.warn(`  ⚠️  Could not get new session token`);
              sessionToken = undefined;
            }
          }

          // Track empty batches
          if (result.seeded === 0) {
            consecutiveEmptyBatches++;
            if (consecutiveEmptyBatches >= maxEmptyBatches) {
              console.log(`  ⚠️  Got ${maxEmptyBatches} empty batches in a row, moving to next difficulty...`);
              break;
            }
          } else {
            consecutiveEmptyBatches = 0;
          }

        } catch (error) {
          console.error(`  ✗ Error:`, error instanceof Error ? error.message : error);
          totalErrors++;
          consecutiveEmptyBatches++;
          
          // If token error, get a new one
          if (error instanceof Error && error.message.includes('Token')) {
            try {
              sessionToken = await getOpenTDBSessionToken();
              console.log(`  🔄 Got new session token`);
            } catch (tokenError) {
              console.warn(`  ⚠️  Could not get new session token`);
            }
          }
        }

        // Small break between categories
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (totalSeeded >= TARGET_COUNT) {
        break;
      }
    }

    if (totalSeeded >= TARGET_COUNT) {
      break;
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Seeding Complete!`);
  console.log(`   Total seeded: ${totalSeeded} new questions`);
  console.log(`   Total errors/skipped: ${totalErrors}`);
  console.log(`   Requests made: ${requestsMade}`);
  console.log(`   Duration: ${duration} minutes`);
  console.log(`   Average: ${(totalSeeded / requestsMade).toFixed(1)} questions per request`);
  console.log(`${'='.repeat(50)}\n`);
}

main().catch(console.error);

