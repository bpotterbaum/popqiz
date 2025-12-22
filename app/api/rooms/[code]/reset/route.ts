import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getNextQuestionForRoom } from '@/lib/questions';
import { assignTeamColorAndName } from '@/lib/utils';

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

    // Get all players in the room
    const { data: players, error: playersFetchError } = await supabase
      .from('players')
      .select('id')
      .eq('room_id', room.id);

    if (playersFetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch players', details: playersFetchError },
        { status: 500 }
      );
    }

    // Reassign team names and colors to all players
    const assignedTeams: Array<{ team_color: string; team_name: string }> = [];
    
    for (const player of players || []) {
      const { color, name } = assignTeamColorAndName(assignedTeams);
      assignedTeams.push({ team_color: color, team_name: name });
      
      const { error: updateError } = await supabase
        .from('players')
        .update({
          team_color: color,
          team_name: name,
          score: 0,
        })
        .eq('id', player.id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update player', details: updateError },
          { status: 500 }
        );
      }
    }

    // Clear room question history so the new game starts fresh.
    await supabase.from('room_questions').delete().eq('room_id', room.id);

    // Get new question (round 1) and record it for this room.
    const question = await getNextQuestionForRoom({
      roomId: room.id,
      ageBand: room.age_band,
      roundNumber: 1,
      minQualityScore: 70,
    });
    const roundEndsAt = new Date(Date.now() + 20 * 1000); // 20 seconds

    // Reset room state
    const { error: updateError } = await supabase
      .from('rooms')
      .update({
        round_number: 1,
        current_question_id: question.id,
        round_ends_at: roundEndsAt.toISOString(),
      })
      .eq('id', room.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to reset room', details: updateError },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error resetting game:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

