import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { assignTeamColorAndName } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Room code required' },
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

    // Find room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Check if player already exists
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .eq('device_id', deviceId)
      .single();

    if (existingPlayer) {
      return NextResponse.json({
        room: {
          id: room.id,
          code: room.code,
          age_band: room.age_band,
          round_number: room.round_number,
          current_question_id: room.current_question_id,
          round_ends_at: room.round_ends_at,
        },
        player: existingPlayer,
      });
    }

    // Get existing players to assign unique color/name
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('team_color, team_name')
      .eq('room_id', room.id);

    const { color, name } = assignTeamColorAndName(existingPlayers || []);

    // Create player
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
      return NextResponse.json(
        { error: 'Failed to join room', details: playerError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        age_band: room.age_band,
        round_number: room.round_number,
        current_question_id: room.current_question_id,
        round_ends_at: room.round_ends_at,
      },
      player,
    });
  } catch (error) {
    console.error('Error joining room:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

