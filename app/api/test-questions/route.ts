import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to get test questions for UI testing
 * GET /api/test-questions?type=2|3|4
 * 
 * Returns test questions with specific choice counts:
 * - type=2: True/False (2 choices)
 * - type=3: Multiple choice (3 choices)
 * - type=4: Multiple choice (4 choices)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || '3';

    let testQuestion;

    switch (type) {
      case '2':
        testQuestion = {
          question: 'This is a True/False test question. The answer is True.',
          choices: ['True', 'False'],
          correct_index: 0,
        };
        break;
      case '4':
        testQuestion = {
          question: 'This is a test question with 4 answer choices. Which is correct?',
          choices: [
            'First choice (wrong)',
            'Second choice (correct)',
            'Third choice (wrong)',
            'Fourth choice (wrong)'
          ],
          correct_index: 1,
        };
        break;
      case '3':
      default:
        testQuestion = {
          question: 'This is a test question with 3 answer choices. Which is correct?',
          choices: [
            'First choice (wrong)',
            'Second choice (correct)',
            'Third choice (wrong)'
          ],
          correct_index: 1,
        };
        break;
    }

    return NextResponse.json({
      question: testQuestion.question,
      answers: testQuestion.choices,
      correctAnswerIndex: testQuestion.correct_index,
      type: `test-${type}-choice`,
    });
  } catch (error) {
    console.error('Error in test-questions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

