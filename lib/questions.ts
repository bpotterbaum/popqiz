import OpenAI from 'openai';
import { createServerClient } from './supabase';
import crypto from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type AgeBand = 'kids' | 'tweens' | 'family' | 'adults';

interface Question {
  question: string;
  choices: string[];
  correct_index: number;
  explanation?: string;
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

  // Length sanity
  if (question.length >= 20 && question.length <= 120) score += 10;
  if (question.length < 15 || question.length > 180) score -= 20;

  // Avoid "All of the above"/"None of the above" with only 3 choices (often low quality)
  const badChoicePhrases = ['all of the above', 'none of the above', 'all of these', 'none of these'];
  const hasBadChoice = choices.some((c) => badChoicePhrases.some((p) => c.toLowerCase().includes(p)));
  if (hasBadChoice) score -= 25;

  // Avoid trivia that is too vague
  const vaguePhrases = ['approximately', 'about how many', 'roughly', 'often', 'usually', 'generally'];
  if (vaguePhrases.some((p) => question.toLowerCase().includes(p))) score -= 10;

  // Penalize duplicate/too-similar choices
  const normalizedChoices = choices.map(normalizeQuestionText);
  if (new Set(normalizedChoices).size < 3) score -= 30;

  // Prefer having an explanation (signals higher quality)
  if (q.explanation && q.explanation.trim().length >= 10) score += 5;

  // Clamp
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return score;
}

// Generate questions using OpenAI
export async function generateQuestions(ageBand: AgeBand, count: number = 20): Promise<Question[]> {
  const ageDescriptions: Record<AgeBand, string> = {
    kids: 'ages 6-9, simple vocabulary, fun topics',
    tweens: 'ages 10-13, slightly more complex, engaging topics',
    family: 'all ages, accessible to both kids and adults',
    adults: 'adult-level knowledge, various topics',
  };

  const prompt = `Generate ${count} trivia questions suitable for ${ageDescriptions[ageBand]}.

Each question must:
- Have exactly 3 answer choices
- Have one clearly correct answer
- Be appropriate for the age group
- Be engaging and fun
- Cover diverse topics (science, history, pop culture, geography, etc.)

Return ONLY a JSON array of objects with this exact structure:
[
  {
    "question": "The question text",
    "choices": ["Choice A", "Choice B", "Choice C"],
    "correct_index": 0,
    "explanation": "Brief explanation (optional)"
  }
]

Make sure correct_index is 0, 1, or 2 corresponding to the correct choice.`;

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
      if (
        typeof q.question === 'string' &&
        Array.isArray(q.choices) &&
        q.choices.length === 3 &&
        typeof q.correct_index === 'number' &&
        q.correct_index >= 0 &&
        q.correct_index <= 2 &&
        new Set(q.choices).size === 3 && // All choices unique
        q.question.length > 10 &&
        q.question.length < 200
      ) {
        validQuestions.push({
          question: q.question.trim(),
          choices: q.choices.map((c: string) => c.trim()),
          correct_index: q.correct_index,
          explanation: q.explanation?.trim(),
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
  options?: { minQualityScore?: number }
): Promise<void> {
  const supabase = createServerClient();

  const minQualityScore = options?.minQualityScore ?? 70;

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
export async function ensureQuestionCache(ageBand: AgeBand, minCount: number = 50): Promise<void> {
  const count = await getQuestionCount(ageBand);
  
  if (count < minCount) {
    // Over-generate because we'll filter for quality and dedupe.
    const needed = Math.max(20, minCount - count);
    const batchSize = Math.min(60, Math.max(30, needed * 2));
    console.log(`Generating ~${batchSize} questions for age band: ${ageBand} (need ${needed} cached)`);
    const questions = await generateQuestions(ageBand, batchSize);
    await cacheQuestions(ageBand, questions, { minQualityScore: 70 });
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
  await ensureQuestionCache(params.ageBand, 100);

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
    await ensureQuestionCache(params.ageBand, 150);

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
  await ensureQuestionCache(ageBand, 100);
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

