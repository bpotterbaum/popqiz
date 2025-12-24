import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateRoomCode, assignTeamColorAndName } from '@/lib/utils';
import { getRandomQuestion } from '@/lib/questions';

export async function POST(request: NextRequest) {
  let age_band;
  try {
    age_band = (await request.json()).age_band;

    if (!age_band || !['kids', 'tweens', 'family', 'adults'].includes(age_band)) {
      return NextResponse.json(
        { error: 'Invalid age_band' },
        { status: 400 }
      );
    }

    const deviceId = request.headers.get('x-device-id') || '';
    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Generate unique room code
    let code: string;
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 10) {
      code = generateRoomCode();
      const { data } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', code)
        .single();
      exists = !!data;
      attempts++;
    }

    if (exists) {
      return NextResponse.json(
        { error: 'Failed to generate unique room code' },
        { status: 500 }
      );
    }

    // Get first question
    const question = await getRandomQuestion(age_band);
    const roundEndsAt = new Date(Date.now() + 20 * 1000); // 20 seconds

    // Create room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code: code!,
        age_band,
        current_question_id: question.id,
        round_ends_at: roundEndsAt.toISOString(),
      })
      .select()
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Failed to create room', details: roomError },
        { status: 500 }
      );
    }

    // Record the first question for this room to avoid repeats in-session.
    // Use round_number from room (defaults to 1).
    await supabase.from('room_questions').insert({
      room_id: room.id,
      round_number: room.round_number,
      question_id: question.id,
    });

    // Create first player (host)
    const { color, name } = assignTeamColorAndName([]);
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        room_id: room.id,
        device_id: deviceId,
        team_name: name,
        team_color: color,
      })
      .select()
      .single();

    if (playerError || !player) {
      console.error('Player creation error:', {
        playerError,
        roomId: room.id,
        deviceId,
        teamName: name,
        teamColor: color,
        hasPlayer: !!player,
      });
      // Clean up room if player creation fails
      await supabase.from('rooms').delete().eq('id', room.id);
      return NextResponse.json(
        { error: 'Failed to create player', details: playerError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      code: room.code,
      player_id: player.id,
      room: {
        id: room.id,
        code: room.code,
        age_band: room.age_band,
        round_number: room.round_number,
        current_question_id: room.current_question_id,
        round_ends_at: room.round_ends_at,
      },
    });
  } catch (error) {
    console.error('Error creating room:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Provide a more user-friendly error message for missing questions
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('No questions found for age band')) {
      return NextResponse.json(
        { error: `No questions available for ${age_band}. Please seed questions first using the admin panel.` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

