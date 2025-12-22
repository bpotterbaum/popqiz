import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getRandomQuestion } from '@/lib/questions';

export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { player_id, feedback_type } = await request.json();
    const code = params.code;

    if (!player_id || !feedback_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['skip', 'inappropriate', 'confusing'].includes(feedback_type)) {
      return NextResponse.json(
        { error: 'Invalid feedback_type' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Get room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, current_question_id, age_band, round_number')
      .eq('code', code.toUpperCase())
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Record feedback
    if (room.current_question_id) {
      await supabase.from('question_feedback').insert({
        room_id: room.id,
        player_id,
        question_id: room.current_question_id,
        feedback_type,
      });
    }

    // Immediately advance to next question (no points awarded)
    const nextQuestion = await getRandomQuestion(room.age_band);
    const roundEndsAt = new Date(Date.now() + 20 * 1000);

    const { error: updateError } = await supabase
      .from('rooms')
      .update({
        round_number: room.round_number + 1,
        current_question_id: nextQuestion.id,
        round_ends_at: roundEndsAt.toISOString(),
      })
      .eq('id', room.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to skip question', details: updateError },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error skipping question:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

