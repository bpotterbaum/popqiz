import { NextRequest, NextResponse } from 'next/server';
import { seedFromOpenTDB } from '@/lib/questions';

/**
 * API route to seed questions from OpenTDB
 * 
 * POST /api/admin/seed-opentdb
 * 
 * Body (optional):
 * {
 *   "amount": 50,
 *   "difficulty": "easy" | "medium",
 *   "ageBand": "adults" (OpenTDB is only used for adults)
 * }
 * 
 * Note: This endpoint respects OpenTDB rate limits (1 request per 5 seconds)
 * Note: OpenTDB is only used for adults. Kids and tweens use AI-generated questions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    const { amount, difficulty, ageBand } = body;

    const result = await seedFromOpenTDB({
      amount: amount || 50,
      difficulty,
      ageBand,
    });

    return NextResponse.json({
      success: true,
      seeded: result.seeded,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Error seeding from OpenTDB:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

