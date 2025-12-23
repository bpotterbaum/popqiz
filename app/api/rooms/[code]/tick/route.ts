import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getNextQuestionForRoom } from '@/lib/questions';

export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code;
    const supabase = createServerClient();

    // Get room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    const now = new Date();
    const roundEndsAt = room.round_ends_at ? new Date(room.round_ends_at) : null;

    // Check if round should end
    const shouldEndRound =
      !roundEndsAt || // No end time set
      now >= roundEndsAt || // Time expired
      (await allPlayersAnswered(supabase, room.id, room.round_number)); // All answered

    if (!shouldEndRound) {
      return NextResponse.json({ ok: true, advanced: false });
    }

    // Score the round
    await scoreRound(supabase, room.id, room.round_number, room.current_question_id!);

    // Advance to next round
    const nextQuestion = await getNextQuestionForRoom({
      roomId: room.id,
      ageBand: room.age_band,
      roundNumber: room.round_number + 1,
      minQualityScore: 70,
    });
    // Account for: reveal/reflection phase (10s) + question (20s) = 30 seconds total
    // Round up to 31 seconds to account for any processing delays
    const nextRoundEndsAt = new Date(Date.now() + 31 * 1000);

    const { error: updateError } = await supabase
      .from('rooms')
      .update({
        round_number: room.round_number + 1,
        current_question_id: nextQuestion.id,
        round_ends_at: nextRoundEndsAt.toISOString(),
      })
      .eq('id', room.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to advance round', details: updateError },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, advanced: true });
  } catch (error) {
    console.error('Error ticking room:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function allPlayersAnswered(
  supabase: ReturnType<typeof createServerClient>,
  roomId: string,
  roundNumber: number
): Promise<boolean> {
  // Get all players in room
  const { data: players } = await supabase
    .from('players')
    .select('id')
    .eq('room_id', roomId);

  if (!players || players.length === 0) {
    return false;
  }

  // Get all answers for this round
  const { data: answers } = await supabase
    .from('answers')
    .select('player_id')
    .eq('room_id', roomId)
    .eq('round_number', roundNumber);

  const answeredPlayerIds = new Set(answers?.map((a) => a.player_id) || []);
  return players.every((p) => answeredPlayerIds.has(p.id));
}

async function scoreRound(
  supabase: ReturnType<typeof createServerClient>,
  roomId: string,
  roundNumber: number,
  questionId: string
): Promise<void> {
  // Get room to find round_ends_at for timing calculations
  const { data: room } = await supabase
    .from('rooms')
    .select('round_ends_at')
    .eq('id', roomId)
    .single();

  const roundEndsAt = room?.round_ends_at ? new Date(room.round_ends_at).getTime() : null;
  const roundDuration = 20 * 1000; // 20 seconds in milliseconds

  // Get correct answer index
  const { data: question } = await supabase
    .from('question_cache')
    .select('correct_index')
    .eq('id', questionId)
    .single();

  if (!question) {
    return;
  }

  // Get all answers for this round
  const { data: answers } = await supabase
    .from('answers')
    .select('*')
    .eq('room_id', roomId)
    .eq('round_number', roundNumber);

  if (!answers || answers.length === 0) {
    return;
  }

  // Find correct answers
  const correctAnswers = answers.filter(
    (a) => a.answer_index === question.correct_index
  );

  if (correctAnswers.length === 0) {
    // No correct answers, update is_correct flags and set points to 0
    for (const answer of answers) {
      await supabase
        .from('answers')
        .update({ is_correct: false, points: 0 })
        .eq('id', answer.id);
    }
    return;
  }

  // Calculate points for each correct answer based on time remaining
  const basePoints = 500;
  
  for (const answer of correctAnswers) {
    let points = 0;
    let multiplier = 1.0;

    if (roundEndsAt && answer.answered_at) {
      const answeredAt = new Date(answer.answered_at).getTime();
      const timeRemaining = Math.max(0, roundEndsAt - answeredAt);
      const timeRemainingPercent = timeRemaining / roundDuration;

      // Determine speed multiplier based on time remaining
      if (timeRemainingPercent >= 0.75) {
        // Top 25% of timer
        multiplier = 1.5;
      } else if (timeRemainingPercent >= 0.5) {
        // 25-50%
        multiplier = 1.25;
      } else if (timeRemainingPercent >= 0.25) {
        // 50-75%
        multiplier = 1.0;
      } else {
        // Bottom 25%
        multiplier = 0.75;
      }
    }

    points = Math.round(basePoints * multiplier);

    // Update answer with is_correct and points
    await supabase
      .from('answers')
      .update({ is_correct: true, points })
      .eq('id', answer.id);

    // Update player score
    const { data: player } = await supabase
      .from('players')
      .select('score')
      .eq('id', answer.player_id)
      .single();

    if (player) {
      await supabase
        .from('players')
        .update({ score: player.score + points })
        .eq('id', answer.player_id);
    }
  }

  // Update incorrect answers with 0 points
  const incorrectAnswers = answers.filter(
    (a) => a.answer_index !== question.correct_index
  );
  for (const answer of incorrectAnswers) {
    await supabase
      .from('answers')
      .update({ is_correct: false, points: 0 })
      .eq('id', answer.id);
  }
}

