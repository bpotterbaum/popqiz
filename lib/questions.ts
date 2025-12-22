import OpenAI from 'openai';
import { createServerClient } from './supabase';

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
export async function cacheQuestions(ageBand: AgeBand, questions: Question[]): Promise<void> {
  const supabase = createServerClient();

  const inserts = questions.map((q) => ({
    age_band: ageBand,
    question: q.question,
    choices: q.choices,
    correct_index: q.correct_index,
    explanation: q.explanation,
  }));

  const { error } = await supabase.from('question_cache').insert(inserts);
  if (error) {
    throw error;
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
    const needed = Math.max(20, minCount - count);
    console.log(`Generating ${needed} questions for age band: ${ageBand}`);
    const questions = await generateQuestions(ageBand, needed);
    await cacheQuestions(ageBand, questions);
  }
}

// Get a random question for an age band
export async function getRandomQuestion(ageBand: AgeBand): Promise<Question & { id: string }> {
  const supabase = createServerClient();

  // Ensure we have questions
  await ensureQuestionCache(ageBand, 10);

  const { data, error } = await supabase
    .from('question_cache')
    .select('id, question, choices, correct_index, explanation')
    .eq('age_band', ageBand)
    .limit(100);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error(`No questions found for age band: ${ageBand}`);
  }

  // Pick random question
  const randomIndex = Math.floor(Math.random() * data.length);
  const question = data[randomIndex];

  return {
    id: question.id,
    question: question.question,
    choices: question.choices as string[],
    correct_index: question.correct_index,
    explanation: question.explanation || undefined,
  };
}

