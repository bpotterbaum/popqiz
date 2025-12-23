import OpenAI from 'openai';
import { createServerClient } from './supabase';
import crypto from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export type AgeBand = 'kids' | 'tweens' | 'family' | 'adults';
export type QuestionSource = 'opentdb' | 'openai';

interface Question {
  question: string;
  choices: string[]; // Now supports 2-4 choices (True/False=2, Multiple=3 or 4)
  correct_index: number;
  explanation?: string;
  source?: QuestionSource; // Track where question came from
}

function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function questionHash(ageBand: AgeBand, question: string, choices: string[]): string {
  const normalized = normalizeQuestionText(question);
  // Choices can vary slightly; include them to avoid near-duplicate collisions.
  const normalizedChoices = choices.map(normalizeQuestionText).sort().join('|');
  return crypto
    .createHash('sha256')
    .update(`${ageBand}::${normalized}::${normalizedChoices}`)
    .digest('hex');
}

function heuristicQualityScore(q: Question): number {
  // Lightweight, deterministic scoring (0-100). We can later add an LLM judge, but this is a good start.
  let score = 60;

  const question = q.question.trim();
  const choices = q.choices.map((c) => c.trim());
  const choiceCount = choices.length;

  // Length sanity
  if (question.length >= 20 && question.length <= 120) score += 10;
  if (question.length < 15 || question.length > 180) score -= 20;

  // Adjust scoring based on choice count
  if (choiceCount === 2) {
    // True/False questions: slightly lower base score but can be high quality
    score += 5;
  } else if (choiceCount === 4) {
    // 4 choices: slightly higher score (more challenging)
    score += 5;
  }

  // Avoid "All of the above"/"None of the above" in multiple choice
  if (choiceCount >= 3) {
    const badChoicePhrases = ['all of the above', 'none of the above', 'all of these', 'none of these'];
    const hasBadChoice = choices.some((c) => badChoicePhrases.some((p) => c.toLowerCase().includes(p)));
    if (hasBadChoice) score -= 25;
  }

  // Avoid trivia that is too vague
  const vaguePhrases = ['approximately', 'about how many', 'roughly', 'often', 'usually', 'generally'];
  if (vaguePhrases.some((p) => question.toLowerCase().includes(p))) score -= 10;

  // Penalize duplicate/too-similar choices
  const normalizedChoices = choices.map(normalizeQuestionText);
  if (new Set(normalizedChoices).size < choiceCount) score -= 30;

  // Prefer having an explanation (signals higher quality)
  if (q.explanation && q.explanation.trim().length >= 10) score += 5;

  // Clamp
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return score;
}

// Extra filters to keep kids questions gentle and readable
function isKidsFriendly(question: string, choices: string[]): boolean {
  const text = question.trim();
  const words = text.split(/\s+/);
  const longestWord = words.reduce((max, w) => Math.max(max, w.length), 0);

  // Keep questions short and simple
  if (text.length > 120) return false;
  if (words.length > 18) return false;
  if (longestWord > 14) return false;

  // Avoid choices with very long words or phrases
  const maxChoiceLen = Math.max(...choices.map((c) => c.trim().length));
  if (maxChoiceLen > 60) return false;

  return true;
}

const kidsTopics = [
  'Bluey',
  'Paw Patrol',
  'Sesame Street',
  'Peppa Pig',
  'Mickey Mouse',
  'Disney Princesses',
  'Pixar',
  'Toy Story',
  'Super Mario',
  'Pokémon',
  'Animals',
  'Pets',
  'Dinosaurs',
  'Colors',
  'Shapes',
  'Numbers',
  'Seasons',
  'Weather',
  'Sports for kids',
  'Snacks and foods kids know',
  'Playground fun',
  'Space basics (sun, moon, stars)',
  'Ocean and beach',
  'Birthday parties',
  'Fairy tales',
  'Bugs and insects',
];

const tweensTopics = [
  'Video Games (Minecraft, Fortnite, Roblox, Among Us, etc.)',
  'Anime (Pokémon, Dragon Ball, Naruto, etc.)',
  'Superheroes (Marvel, DC)',
  'Disney movies and shows',
  'Harry Potter',
  'Star Wars',
  'Sports (soccer, basketball, football, etc.)',
  'Science (space, animals, earth science)',
  'Geography (countries, capitals, landmarks)',
  'History (ancient civilizations, explorers, etc.)',
  'Music (popular artists, instruments, genres)',
  'Social Media and Internet culture',
  'Animals and nature',
  'Technology and computers',
  'Books and reading',
  'Art and creativity',
  'Food and cooking',
  'Fashion and trends',
  'Movies and TV shows',
  'Sports stars and athletes',
];

type GeneratedKidQuestion = {
  question: string;
  choices: string[];
  correct_index: number;
  explanation?: string;
  topic?: string;
};

type GeneratedTweenQuestion = {
  question: string;
  choices: string[];
  correct_index: number;
  explanation?: string;
  topic?: string;
};

function isSimpleWord(word: string): boolean {
  return word.length <= 12 && !/[0-9]/.test(word);
}

function isKidsQuestionValid(q: GeneratedKidQuestion): boolean {
  if (!q || typeof q.question !== 'string' || !Array.isArray(q.choices)) return false;
  const question = q.question.trim();
  const choices = q.choices.map((c) => (typeof c === 'string' ? c.trim() : '')).filter(Boolean);

  if (choices.length < 3 || choices.length > 4) return false;
  if (new Set(choices.map((c) => c.toLowerCase())).size !== choices.length) return false;
  if (q.correct_index == null || q.correct_index < 0 || q.correct_index >= choices.length) return false;

  // Length and simplicity checks
  if (question.length < 8 || question.length > 100) return false;
  const words = question.split(/\s+/);
  if (words.length > 18) return false;
  if (!words.every(isSimpleWord)) return false;
  if (Math.max(...choices.map((c) => c.length)) > 40) return false;

  // Avoid trivia-ish schooly or numeric-heavy content
  if (/\d{3,}/.test(question)) return false;

  // Ensure kids-friendliness gate
  if (!isKidsFriendly(question, choices)) return false;

  return true;
}

// Generate fun, smile-inducing kids questions via OpenAI with strict validation
export async function generateKidsAIQuestions(
  count: number = 20
): Promise<Question[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured - skipping kids AI generation');
    return [];
  }

  const topicList = kidsTopics.join(', ');

  const systemPrompt = `You create delightful trivia for kids around age 6.
Rules:
- Keep it fun and playful, not schooly.
- Use simple words and short sentences kids actually know.
- Topics must come from this list: ${topicList}.
- Do NOT invent new characters or obscure facts; only well-known kid-friendly facts.
- No years, no episode numbers, no scores/stats, no violent or scary content.
- 1 question, 3-4 choices; one clearly correct.
- Question <= 100 characters; each choice <= 40 characters.
- Avoid long words (<=12 letters) and long questions (<=18 words).
- Make kids smile: playful tone, but concise and clear.`;

  const userPrompt = `Generate ${count} kid-friendly trivia questions as JSON.

Return exactly:
{
  "questions": [
    {
      "question": "text",
      "choices": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "a thoughtful, informative explanation that teaches something interesting (2-3 sentences, 150-250 characters)",
      "topic": "one of the allowed topics"
    }
  ]
}

Requirements:
- Use only allowed topics: ${topicList}
- No duplicate questions; no duplicate choices within a question.
- Keep questions short, vivid, and fun. Avoid sounding like a test.
- Explanations should be informative and educational - explain WHY or HOW, share an interesting fact, or add context that makes kids go "wow!" - but still use simple words kids understand.
- Keep explanations engaging and delightful, not just restating the answer.
- No emojis.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: Math.max(4000, count * 120), // Allow plenty of tokens for questions with longer explanations
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    console.warn('No response content from OpenAI');
    return [];
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse kids AI JSON:', err);
    console.error('Raw response length:', raw.length);
    console.error('Raw response (first 500 chars):', raw.substring(0, 500));
    console.error('Raw response (last 200 chars):', raw.substring(Math.max(0, raw.length - 200)));
    
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || raw.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
        console.log('Successfully extracted JSON from code block');
      } catch (retryErr) {
        // If still failing, try to fix common truncation issues
        let fixedJson = jsonMatch[1];
        // If it ends mid-object, try to close it properly
        if (!fixedJson.trim().endsWith('}')) {
          // Count unclosed braces and arrays
          const openBraces = (fixedJson.match(/\{/g) || []).length;
          const closeBraces = (fixedJson.match(/\}/g) || []).length;
          const openArrays = (fixedJson.match(/\[/g) || []).length;
          const closeArrays = (fixedJson.match(/\]/g) || []).length;
          
          // Try to close incomplete last question object
          const lastBraceIndex = fixedJson.lastIndexOf('}');
          const lastBracketIndex = fixedJson.lastIndexOf(']');
          if (lastBracketIndex > lastBraceIndex) {
            // We're inside the questions array
            // Try to close the last incomplete object and array
            fixedJson = fixedJson.trim();
            if (!fixedJson.endsWith(']')) {
              // Remove trailing comma if present
              fixedJson = fixedJson.replace(/,\s*$/, '');
              fixedJson += ']';
            }
            if (!fixedJson.endsWith('}')) {
              fixedJson += '}';
            }
          }
          
          try {
            parsed = JSON.parse(fixedJson);
            console.log('Successfully parsed fixed JSON');
          } catch (fixErr) {
            // Last resort: try regex extraction of valid question objects
            console.warn('JSON repair failed, attempting regex extraction of valid questions...');
            const questionRegex = /\{\s*"question"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*,\s*"choices"\s*:\s*\[([^\]]+)\]\s*,\s*"correct_index"\s*:\s*(\d+)(?:\s*,\s*"explanation"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)")?(?:\s*,\s*"topic"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)")?\s*\}/g;
            const extractedQuestions: any[] = [];
            let match;
            while ((match = questionRegex.exec(jsonMatch[1])) !== null) {
              try {
                const choicesStr = match[2];
                const choices = choicesStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)?.map(c => JSON.parse(c)) || [];
                if (choices.length >= 3 && choices.length <= 4 && parseInt(match[3]) >= 0 && parseInt(match[3]) < choices.length) {
                  extractedQuestions.push({
                    question: JSON.parse(`"${match[1]}"`),
                    choices: choices,
                    correct_index: parseInt(match[3]),
                    explanation: match[4] ? JSON.parse(`"${match[4]}"`) : undefined,
                    topic: match[5] ? JSON.parse(`"${match[5]}"`) : undefined,
                  });
                }
              } catch (extractErr) {
                // Skip this question
              }
            }
            if (extractedQuestions.length > 0) {
              console.log(`Extracted ${extractedQuestions.length} valid questions from partial JSON`);
              parsed = { questions: extractedQuestions };
            } else {
              console.error('Failed to extract any valid questions from partial JSON');
              return [];
            }
          }
        } else {
          console.error('Failed to parse extracted JSON:', retryErr);
          return [];
        }
      }
    } else {
      return [];
    }
  }

  const questions: GeneratedKidQuestion[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.questions)
    ? parsed.questions
    : [];

  const valid: Question[] = [];
  for (const q of questions) {
    if (!isKidsQuestionValid(q)) continue;
    valid.push({
      question: q.question.trim(),
      choices: q.choices.map((c) => c.trim()),
      correct_index: q.correct_index,
      explanation: q.explanation?.trim(),
      source: 'openai',
    });
    if (valid.length >= count) break;
  }

  return valid;
}

function isTweensQuestionValid(q: GeneratedTweenQuestion): boolean {
  if (!q || typeof q.question !== 'string' || !Array.isArray(q.choices)) return false;
  const question = q.question.trim();
  const choices = q.choices.map((c) => (typeof c === 'string' ? c.trim() : '')).filter(Boolean);

  if (choices.length < 3 || choices.length > 4) return false;
  if (new Set(choices.map((c) => c.toLowerCase())).size !== choices.length) return false;
  if (q.correct_index == null || q.correct_index < 0 || q.correct_index >= choices.length) return false;

  // Tweens can handle slightly longer questions and choices than kids
  if (question.length < 10 || question.length > 150) return false;
  const words = question.split(/\s+/);
  if (words.length > 25) return false;
  if (Math.max(...choices.map((c) => c.length)) > 60) return false;

  return true;
}

// Generate engaging trivia questions for tweens (ages 10-13) via OpenAI
export async function generateTweensAIQuestions(
  count: number = 20
): Promise<Question[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured - skipping tweens AI generation');
    return [];
  }

  const topicList = tweensTopics.join(', ');

  const systemPrompt = `You create engaging trivia for tweens (ages 10-13).
Rules:
- Keep it fun, interesting, and age-appropriate - not too childish, not too adult.
- Use vocabulary that tweens understand and find relatable.
- Topics must come from this list: ${topicList}.
- Focus on popular culture, games, movies, shows, and topics tweens actually care about.
- 1 question, 3-4 choices; one clearly correct.
- Question <= 150 characters; each choice <= 60 characters.
- Make it engaging and exciting - tweens love to show off what they know.
- Educational but in a fun, cool way - not boring school stuff.`;

  const userPrompt = `Generate ${count} engaging trivia questions for tweens as JSON.

Return exactly:
{
  "questions": [
    {
      "question": "text",
      "choices": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "a thoughtful, informative explanation that teaches something interesting (2-3 sentences, 150-300 characters)",
      "topic": "one of the allowed topics"
    }
  ]
}

Requirements:
- Use only allowed topics: ${topicList}
- No duplicate questions; no duplicate choices within a question.
- Keep questions engaging, relatable, and fun for tweens.
- Explanations should be informative and educational - explain WHY or HOW, share interesting facts, or add cool context that makes tweens go "wow!" - use age-appropriate language.
- Keep explanations engaging and delightful, not just restating the answer.
- No emojis.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: Math.max(4000, count * 130), // Allow plenty of tokens for questions with longer explanations
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    console.warn('No response content from OpenAI');
    return [];
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse tweens AI JSON:', err);
    console.error('Raw response length:', raw.length);
    console.error('Raw response (first 500 chars):', raw.substring(0, 500));
    console.error('Raw response (last 200 chars):', raw.substring(Math.max(0, raw.length - 200)));
    
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || raw.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
        console.log('Successfully extracted JSON from code block');
      } catch (retryErr) {
        // If still failing, try to fix common truncation issues
        let fixedJson = jsonMatch[1];
        // If it ends mid-object, try to close it properly
        if (!fixedJson.trim().endsWith('}')) {
          // Count unclosed braces and arrays
          const openBraces = (fixedJson.match(/\{/g) || []).length;
          const closeBraces = (fixedJson.match(/\}/g) || []).length;
          const openArrays = (fixedJson.match(/\[/g) || []).length;
          const closeArrays = (fixedJson.match(/\]/g) || []).length;
          
          // Try to close incomplete last question object
          const lastBraceIndex = fixedJson.lastIndexOf('}');
          const lastBracketIndex = fixedJson.lastIndexOf(']');
          if (lastBracketIndex > lastBraceIndex) {
            // We're inside the questions array
            // Try to close the last incomplete object and array
            fixedJson = fixedJson.trim();
            if (!fixedJson.endsWith(']')) {
              // Remove trailing comma if present
              fixedJson = fixedJson.replace(/,\s*$/, '');
              fixedJson += ']';
            }
            if (!fixedJson.endsWith('}')) {
              fixedJson += '}';
            }
          }
          
          try {
            parsed = JSON.parse(fixedJson);
            console.log('Successfully parsed fixed JSON');
          } catch (fixErr) {
            // Last resort: try regex extraction of valid question objects
            console.warn('JSON repair failed, attempting regex extraction of valid questions...');
            const questionRegex = /\{\s*"question"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*,\s*"choices"\s*:\s*\[([^\]]+)\]\s*,\s*"correct_index"\s*:\s*(\d+)(?:\s*,\s*"explanation"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)")?(?:\s*,\s*"topic"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)")?\s*\}/g;
            const extractedQuestions: any[] = [];
            let match;
            while ((match = questionRegex.exec(jsonMatch[1])) !== null) {
              try {
                const choicesStr = match[2];
                const choices = choicesStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)?.map(c => JSON.parse(c)) || [];
                if (choices.length >= 3 && choices.length <= 4 && parseInt(match[3]) >= 0 && parseInt(match[3]) < choices.length) {
                  extractedQuestions.push({
                    question: JSON.parse(`"${match[1]}"`),
                    choices: choices,
                    correct_index: parseInt(match[3]),
                    explanation: match[4] ? JSON.parse(`"${match[4]}"`) : undefined,
                    topic: match[5] ? JSON.parse(`"${match[5]}"`) : undefined,
                  });
                }
              } catch (extractErr) {
                // Skip this question
              }
            }
            if (extractedQuestions.length > 0) {
              console.log(`Extracted ${extractedQuestions.length} valid questions from partial JSON`);
              parsed = { questions: extractedQuestions };
            } else {
              console.error('Failed to extract any valid questions from partial JSON');
              return [];
            }
          }
        } else {
          console.error('Failed to parse extracted JSON:', retryErr);
          return [];
        }
      }
    } else {
      return [];
    }
  }

  const questions: GeneratedTweenQuestion[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.questions)
    ? parsed.questions
    : [];

  const valid: Question[] = [];
  for (const q of questions) {
    if (!isTweensQuestionValid(q)) continue;
    valid.push({
      question: q.question.trim(),
      choices: q.choices.map((c) => c.trim()),
      correct_index: q.correct_index,
      explanation: q.explanation?.trim(),
      source: 'openai',
    });
    if (valid.length >= count) break;
  }

  return valid;
}

// Map OpenTDB difficulty to age bands
function mapDifficultyToAgeBand(difficulty: 'easy' | 'medium' | 'hard'): AgeBand[] {
  switch (difficulty) {
    case 'easy':
      return ['kids', 'tweens', 'family'];
    case 'medium':
      return ['tweens', 'family', 'adults'];
    case 'hard':
      return ['adults'];
    default:
      return ['family'];
  }
}

// Fetch questions from OpenTDB API
interface OpenTDBQuestion {
  category: string;
  type: 'multiple' | 'boolean';
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface OpenTDBResponse {
  response_code: number;
  results: OpenTDBQuestion[];
}

// Seed questions from OpenTDB API
// NOTE: OpenTDB is only used for adults. Kids and tweens use AI-generated questions.
export async function seedFromOpenTDB(
  options?: {
    amount?: number;
    category?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    ageBand?: AgeBand; // Should be 'adults' - OpenTDB is only used for adults
    token?: string; // Session token to avoid duplicates
  }
): Promise<{ seeded: number; errors: number; token?: string | null }> {
  const amount = options?.amount ?? 50;
  const category = options?.category;
  const difficulty = options?.difficulty;
  const targetAgeBand = options?.ageBand;
  const token = options?.token;

  // Build API URL - use url3986 encoding for easier decoding
  let url = `https://opentdb.com/api.php?amount=${Math.min(amount, 50)}&encode=url3986`;
  if (category) url += `&category=${category}`;
  if (difficulty) url += `&difficulty=${difficulty}`;
  if (token) url += `&token=${token}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenTDB API error: ${response.statusText}`);
    }

    const data: OpenTDBResponse = await response.json();

    // Handle response codes
    if (data.response_code === 3) {
      throw new Error('Token not found - session token invalid');
    }
    if (data.response_code === 4) {
      // Token empty - all questions exhausted for this query
      // Return null token to signal exhaustion
      return { seeded: 0, errors: 0, token: null };
    }
    if (data.response_code !== 0 && data.response_code !== 1) {
      // Code 1 = No Results (not enough questions), but we can continue
      if (data.response_code !== 1) {
        throw new Error(`OpenTDB response code: ${data.response_code}`);
      }
      // Code 1 means no results, return empty with same token
      return { seeded: 0, errors: 0, token: token || undefined };
    }

    let seeded = 0;
    let errors = 0;

    // Process each question
    for (const otq of data.results) {
      try {
        // Decode question and answers (url3986 encoding uses decodeURIComponent)
        const question = decodeURIComponent(otq.question);
        const correctAnswer = decodeURIComponent(otq.correct_answer);
        const incorrectAnswers = otq.incorrect_answers.map(a => decodeURIComponent(a));

        // Build choices array
        let choices: string[];
        let correctIndex: number;

        if (otq.type === 'boolean') {
          // True/False: always ["True", "False"]
          choices = ['True', 'False'];
          correctIndex = correctAnswer.toLowerCase() === 'true' ? 0 : 1;
        } else {
          // Multiple choice: combine correct + incorrect, shuffle
          choices = [correctAnswer, ...incorrectAnswers];
          // Shuffle to randomize position
          for (let i = choices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [choices[i], choices[j]] = [choices[j], choices[i]];
          }
          correctIndex = choices.indexOf(correctAnswer);
        }

        // Determine which age bands to cache this question to
        // If targetAgeBand is specified, only cache to that band (and validate difficulty matches)
        // Otherwise, use the difficulty-based mapping
        let ageBands: AgeBand[];
        
        if (targetAgeBand) {
          // OpenTDB is only used for adults, so validate accordingly
          if (targetAgeBand !== 'adults') {
            console.warn(`Skipping OpenTDB question for ${targetAgeBand} - OpenTDB is only used for adults`);
            continue;
          }
          // Validate that the question's ACTUAL difficulty (from OpenTDB) is appropriate for adults
          // Use easy and medium only (hard is too difficult)
          const appropriateDifficulties = ['easy', 'medium'];
          
          // Always validate the actual difficulty returned by OpenTDB
          if (!appropriateDifficulties.includes(otq.difficulty)) {
            // Skip this question - difficulty mismatch with target age band
            continue;
          }
          
          // Also validate that if a difficulty was explicitly requested, it matches what we got
          // This is an extra safety check
          if (difficulty && otq.difficulty !== difficulty) {
            // Skip - OpenTDB returned a different difficulty than requested
            continue;
          }
          
          ageBands = [targetAgeBand];
        } else {
          // No target specified - default to adults only (OpenTDB is only used for adults)
          // Use easy and medium difficulty only (hard is too difficult)
          if (otq.difficulty === 'easy' || otq.difficulty === 'medium') {
            ageBands = ['adults'];
          } else {
            // Skip hard questions - they're too difficult
            continue;
          }
        }

        // Generate a single family-friendly explanation for this question (reused across all age bands)
        const explanation = await generateExplanation(question, correctAnswer);
        
        // Create question object with explanation (same explanation for all age bands)
        const questionObj: Question = {
          question,
          choices,
          correct_index: correctIndex,
          explanation,
          source: 'opentdb',
        };

        // Cache for each matching age band (reusing the same explanation)
        // Note: OpenTDB is only used for adults, so we should only cache to adults
        for (const ageBand of ageBands) {
          try {
            // Skip if somehow we got a non-adult age band (safety check)
            if (ageBand !== 'adults') {
              console.warn(`Skipping caching OpenTDB question for ${ageBand} - OpenTDB is only used for adults`);
              continue;
            }

            await cacheQuestions(ageBand, [questionObj], { 
              minQualityScore: 50, // Standard quality threshold for adults
              source: 'opentdb'
            });
            seeded++;
          } catch (error) {
            console.error(`Error caching question for ${ageBand}:`, error);
            errors++;
          }
        }
      } catch (error) {
        console.error('Error processing OpenTDB question:', error);
        errors++;
      }
    }

    // Return the token that was used (or undefined if none)
    return { seeded, errors, token: token || undefined };
  } catch (error) {
    console.error('Error fetching from OpenTDB:', error);
    throw error;
  }
}

// Generate an educational, engaging, and helpful explanation for a question using OpenAI
// Uses a single family-friendly style that works well for all age bands
// Focuses on being informative and substantive while remaining delightful and interesting
async function generateExplanation(
  question: string,
  correctAnswer: string
): Promise<string | undefined> {
  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured - skipping explanation generation');
    return undefined;
  }
  
  const systemPrompt = `You write trivia explanations that are short, helpful, educational, and fun.

Rules:
- No emojis
- One sentence only
- Must teach something (explain why/how or provide key context), not just restate the answer
- Target 140-170 characters. Hard maximum 240 characters
- Sound delightful and curious (like a great teacher), not goofy
- Use engaging, vivid language that makes learning enjoyable
- Balance being fun and interesting with being genuinely helpful and educational`;

  const userPrompt = `Question: "${question}"
Correct Answer: "${correctAnswer}"

Return JSON only: {"explanation":"..."} with the explanation following all the rules.`;

  try {
    // Try up to 2 times - if first attempt is too long, retry with stronger brevity instruction
    for (let attempt = 1; attempt <= 2; attempt++) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: attempt === 1 
              ? userPrompt 
              : `${userPrompt}\n\nSecond try: make it shorter while keeping the same meaning. One sentence only.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7, // Slightly lower for more controlled, consistent responses
        max_tokens: 90, // 240 chars ≈ 60-80 tokens, with buffer for JSON structure
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        console.warn(`No explanation content returned for: ${correctAnswer}`);
        continue;
      }

      // Try to parse JSON response
      let explanation: string | undefined;
      try {
        const parsed = JSON.parse(raw);
        explanation = typeof parsed.explanation === 'string' ? parsed.explanation.trim() : undefined;
      } catch (parseError) {
        // If JSON parsing fails, try to extract explanation from raw text as fallback
        // This handles cases where the model might not follow JSON format exactly
        explanation = raw.replace(/^{[\s\S]*?"explanation"\s*:\s*"([^"]+)"[\s\S]*}$/, '$1') || raw;
        explanation = explanation.trim();
      }

      if (!explanation || explanation.length === 0) {
        console.warn(`Empty explanation extracted for: ${correctAnswer}`);
        continue;
      }

      // Validate length - hard maximum of 240 characters
      if (explanation.length <= 240) {
        console.log(`Successfully generated explanation (${explanation.length} chars, attempt ${attempt}) for: ${correctAnswer}`);
        return explanation;
      }

      // If too long and this is the first attempt, log and try again
      if (attempt === 1) {
        console.warn(`Explanation too long on attempt ${attempt}: ${explanation.length} chars (max 240) for: ${correctAnswer}, retrying...`);
      } else {
        console.warn(`Explanation still too long after ${attempt} attempts: ${explanation.length} chars (max 240) for: ${correctAnswer}`);
      }
    }
    
    return undefined;
  } catch (error) {
    console.error('Error generating explanation:', error);
    // Log more details to help debug
    if (error instanceof Error) {
      console.error('Explanation error details:', error.message, error.stack);
    }
    // Don't fail the seeding if explanation generation fails
    return undefined;
  }
}

// Get a new session token from OpenTDB
export async function getOpenTDBSessionToken(): Promise<string> {
  try {
    const response = await fetch('https://opentdb.com/api_token.php?command=request');
    if (!response.ok) {
      throw new Error(`Failed to get session token: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.response_code !== 0) {
      throw new Error(`Failed to get session token: response code ${data.response_code}`);
    }
    return data.token;
  } catch (error) {
    console.error('Error getting OpenTDB session token:', error);
    throw error;
  }
}

// Generate questions using OpenAI
export async function generateQuestions(
  ageBand: AgeBand, 
  count: number = 20,
  options?: { 
    minChoices?: number; 
    maxChoices?: number;
  }
): Promise<Question[]> {
  const ageDescriptions: Record<AgeBand, string> = {
    kids: 'ages 6-9, simple vocabulary, fun topics',
    tweens: 'ages 10-13, slightly more complex, engaging topics',
    family: 'all ages, accessible to both kids and adults',
    adults: 'adult-level knowledge, various topics',
  };

  const minChoices = options?.minChoices ?? 3;
  const maxChoices = options?.maxChoices ?? 4;

  const prompt = `Generate ${count} trivia questions suitable for ${ageDescriptions[ageBand]}.

Each question must:
- Have between ${minChoices} and ${maxChoices} answer choices (inclusive)
- Have one clearly correct answer
- Be appropriate for the age group
- Be engaging and fun
- Cover diverse topics (science, history, pop culture, geography, etc.)

Return ONLY a JSON array of objects with this exact structure:
[
  {
    "question": "The question text",
    "choices": ["Choice A", "Choice B", "Choice C", ...],
    "correct_index": 0,
    "explanation": "Brief explanation (optional)"
  }
]

Make sure correct_index is 0 to (number of choices - 1) corresponding to the correct choice.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a trivia question generator. Always return valid JSON with a "questions" array.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the response
    const parsed = JSON.parse(response);
    const questions = Array.isArray(parsed) ? parsed : parsed.questions || [];

    // Validate and filter questions
    const validQuestions: Question[] = [];
    for (const q of questions) {
      const choiceCount = Array.isArray(q.choices) ? q.choices.length : 0;
      if (
        typeof q.question === 'string' &&
        Array.isArray(q.choices) &&
        choiceCount >= minChoices &&
        choiceCount <= maxChoices &&
        typeof q.correct_index === 'number' &&
        q.correct_index >= 0 &&
        q.correct_index < choiceCount &&
        new Set(q.choices).size === choiceCount && // All choices unique
        q.question.length > 10 &&
        q.question.length < 200
      ) {
        validQuestions.push({
          question: q.question.trim(),
          choices: q.choices.map((c: string) => c.trim()),
          correct_index: q.correct_index,
          explanation: q.explanation?.trim(),
          source: 'openai',
        });
      }
    }

    return validQuestions;
  } catch (error) {
    console.error('Error generating questions:', error);
    throw error;
  }
}

// Cache questions in database
export async function cacheQuestions(
  ageBand: AgeBand,
  questions: Question[],
  options?: { minQualityScore?: number; source?: QuestionSource }
): Promise<void> {
  const supabase = createServerClient();

  const minQualityScore = options?.minQualityScore ?? 70;
  const source = options?.source ?? questions[0]?.source ?? 'openai';

  const scored = questions
    .map((q) => ({ q, quality_score: heuristicQualityScore(q) }))
    .filter((x) => x.quality_score >= minQualityScore);

  const inserts = scored.map(({ q, quality_score }) => ({
    age_band: ageBand,
    question: q.question,
    question_hash: questionHash(ageBand, q.question, q.choices),
    choices: q.choices,
    correct_index: q.correct_index,
    explanation: q.explanation,
    quality_score,
    source: q.source ?? source,
  }));

  if (inserts.length === 0) return;

  // Check for existing questions with the same hash to avoid duplicates
  const hashes = inserts.map((i) => i.question_hash).filter((h): h is string => h !== null && h !== undefined);
  
  if (hashes.length > 0) {
    const { data: existing } = await supabase
      .from('question_cache')
      .select('question_hash')
      .eq('age_band', ageBand)
      .in('question_hash', hashes);
    
    const existingHashes = new Set((existing || []).map((e) => e.question_hash));
    // Filter out questions that already exist
    const newInserts = inserts.filter((i) => !existingHashes.has(i.question_hash));
    
    if (newInserts.length > 0) {
      const { error } = await supabase.from('question_cache').insert(newInserts);
      if (error) {
        throw error;
      }
    }
  } else {
    // If no hashes, insert all (shouldn't happen, but safe fallback)
    const { error } = await supabase.from('question_cache').insert(inserts);
    if (error) {
      throw error;
    }
  }
}

// Get question count for an age band
export async function getQuestionCount(ageBand: AgeBand): Promise<number> {
  const supabase = createServerClient();
  const { count, error } = await supabase
    .from('question_cache')
    .select('*', { count: 'exact', head: true })
    .eq('age_band', ageBand);

  if (error) {
    throw error;
  }

  return count || 0;
}

// Ensure we have enough questions cached
// Note: With OpenTDB seeding, this is mainly a safety net. Set allowGeneration=false to disable OpenAI fallback.
export async function ensureQuestionCache(
  ageBand: AgeBand, 
  minCount: number = 50,
  options?: { allowGeneration?: boolean }
): Promise<void> {
  const allowGeneration = options?.allowGeneration ?? false; // Default to false - rely on seeded questions
  const count = await getQuestionCount(ageBand);
  
  if (count < minCount) {
    if (allowGeneration) {
      // Only generate if explicitly allowed (safety net for missing questions)
      const needed = Math.max(20, minCount - count);
      const batchSize = Math.min(60, Math.max(30, needed * 2));
      console.log(`Generating ~${batchSize} questions for age band: ${ageBand} (need ${needed} cached)`);
      const questions = await generateQuestions(ageBand, batchSize);
      await cacheQuestions(ageBand, questions, { minQualityScore: 70 });
    } else {
      // Just log a warning - questions should be seeded instead
      console.warn(`Warning: Only ${count} questions cached for ${ageBand} (minimum recommended: ${minCount}). Consider seeding more questions.`);
    }
  }
}

function formatInList(ids: string[]): string {
  // Supabase expects a PostgREST "in" list string: (id1,id2,...)
  // UUIDs must be quoted.
  return `(${ids.map((id) => `"${id}"`).join(',')})`;
}

// Get the next question for a room, avoiding repeats within that room session.
export async function getNextQuestionForRoom(params: {
  roomId: string;
  ageBand: AgeBand;
  // Use round number for recording; selection uses room_questions to avoid repeats.
  roundNumber: number;
  minQualityScore?: number;
}): Promise<Question & { id: string }> {
  const supabase = createServerClient();

  const minQualityScore = params.minQualityScore ?? 70;

  // Ensure we have a decent pool. Default target: 100.
  // Note: With OpenTDB seeding, this won't auto-generate unless explicitly enabled
  await ensureQuestionCache(params.ageBand, 100, { allowGeneration: false });

  // Get already-used question IDs for this room
  const { data: usedRows, error: usedError } = await supabase
    .from('room_questions')
    .select('question_id')
    .eq('room_id', params.roomId);

  if (usedError) throw usedError;

  const usedIds = (usedRows || []).map((r) => r.question_id as string);

  // Fetch candidates (prefer higher quality_score)
  let query = supabase
    .from('question_cache')
    .select('id, question, choices, correct_index, explanation, quality_score')
    .eq('age_band', params.ageBand)
    .gte('quality_score', minQualityScore)
    .order('quality_score', { ascending: false })
    .limit(200);

  if (usedIds.length > 0) {
    query = query.not('id', 'in', formatInList(usedIds));
  }

  let { data, error } = await query;

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    // If we exhausted the pool for this room, relax quality threshold and/or grow cache.
    await ensureQuestionCache(params.ageBand, 150, { allowGeneration: false });

    let fallbackQuery = supabase
      .from('question_cache')
      .select('id, question, choices, correct_index, explanation, quality_score')
      .eq('age_band', params.ageBand)
      .order('quality_score', { ascending: false })
      .limit(200);

    if (usedIds.length > 0) {
      fallbackQuery = fallbackQuery.not('id', 'in', formatInList(usedIds));
    }

    const fallback = await fallbackQuery;
    data = fallback.data;
    error = fallback.error;

    if (error) throw error;
    if (!data || data.length === 0) {
      // As a last resort, allow repeats rather than crashing the game.
      const lastResort = await supabase
        .from('question_cache')
        .select('id, question, choices, correct_index, explanation')
        .eq('age_band', params.ageBand)
        .limit(200);
      if (lastResort.error) throw lastResort.error;
      if (!lastResort.data || lastResort.data.length === 0) {
        throw new Error(`No questions found for age band: ${params.ageBand}`);
      }
      data = lastResort.data as any;
    }
  }

  if (!data) {
    throw new Error(`No questions found for age band: ${params.ageBand}`);
  }

  // Pick randomly among the top candidates to keep variety.
  const pool = data.slice(0, Math.min(50, data.length));
  const randomIndex = Math.floor(Math.random() * pool.length);
  const question = pool[randomIndex] as any;

  // Record question as used for this room (best-effort)
  const { error: recordError } = await supabase.from('room_questions').insert({
    room_id: params.roomId,
    round_number: params.roundNumber,
    question_id: question.id,
  });
  if (recordError) {
    // Don't fail the game if the record insert conflicts (e.g. race); just log.
    console.warn('Failed to record room question:', recordError);
  }

  return {
    id: question.id,
    question: question.question,
    choices: question.choices as string[],
    correct_index: question.correct_index,
    explanation: question.explanation || undefined,
  };
}

// Backwards-compatible helper for existing callers (no room context).
export async function getRandomQuestion(ageBand: AgeBand): Promise<Question & { id: string }> {
  const supabase = createServerClient();
  await ensureQuestionCache(ageBand, 100, { allowGeneration: false });
  const { data, error } = await supabase
    .from('question_cache')
    .select('id, question, choices, correct_index, explanation, quality_score')
    .eq('age_band', ageBand)
    .order('quality_score', { ascending: false })
    .limit(200);
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(`No questions found for age band: ${ageBand}`);
  const pool = data.slice(0, Math.min(50, data.length));
  const randomIndex = Math.floor(Math.random() * pool.length);
  const question = pool[randomIndex];
  return {
    id: question.id,
    question: question.question,
    choices: question.choices as string[],
    correct_index: question.correct_index,
    explanation: question.explanation || undefined,
  };
}

