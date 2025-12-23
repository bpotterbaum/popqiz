import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { player_id, round_number, answer_index } = await request.json();
    const code = params.code;

    if (!player_id || round_number === undefined || answer_index === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (answer_index < 0 || answer_index > 3) {
      return NextResponse.json(
        { error: 'Invalid answer_index' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Get room with round_ends_at for timing
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, current_question_id, round_number, round_ends_at')
      .eq('code', code.toUpperCase())
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Verify round number matches
    if (room.round_number !== round_number) {
      return NextResponse.json(
        { error: 'Round number mismatch' },
        { status: 400 }
      );
    }

    // Check if answer already exists
    const { data: existingAnswer } = await supabase
      .from('answers')
      .select('id')
      .eq('room_id', room.id)
      .eq('player_id', player_id)
      .eq('round_number', round_number)
      .single();

    if (existingAnswer) {
      return NextResponse.json({ ok: true, message: 'Answer already submitted' });
    }

    // Get question to check correctness
    const { data: question } = await supabase
      .from('question_cache')
      .select('correct_index')
      .eq('id', room.current_question_id)
      .single();

    const isCorrect = question?.correct_index === answer_index;

    // Insert answer with timestamp for time-based scoring
    const answeredAt = new Date().toISOString();
    const { error: answerError } = await supabase
      .from('answers')
      .insert({
        room_id: room.id,
        player_id,
        round_number,
        question_id: room.current_question_id!,
        answer_index,
        is_correct: isCorrect,
        answered_at: answeredAt,
      });

    if (answerError) {
      return NextResponse.json(
        { error: 'Failed to submit answer', details: answerError },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error submitting answer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

