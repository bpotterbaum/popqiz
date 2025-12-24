import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateRoomCode, assignTeamColorAndName } from '@/lib/utils';
import { getRandomQuestion } from '@/lib/questions';

export async function POST(request: NextRequest) {
  let age_band; // Declare `age_band` in a broader scope so it can be used in the catch block
  try {
    const requestData = await request.json();
    age_band = requestData.age_band;

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

    // Additional code omitted for brevity...

  } catch (error) {
    console.error('Error creating room:', error);
    console.error(
      'Error stack:',
      error instanceof Error ? error.stack : 'No stack trace'
    );

    // Provide a more user-friendly error message for missing questions
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('No questions found for age band')) {
      return NextResponse.json(
        {
          error: `No questions available for ${age_band}. Please seed questions first using the admin panel.`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}