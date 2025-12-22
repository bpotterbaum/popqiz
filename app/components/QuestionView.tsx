"use client";

import CircularTimer from "./CircularTimer";

interface QuestionViewProps {
  question: string;
  answers: string[];
  onAnswer: (answerIndex: number) => void;
  selectedAnswer: number | null;
  teamColor: string;
  teamName: string;
  roundEndsAt: string | null;
}

export default function QuestionView({
  question,
  answers,
  onAnswer,
  selectedAnswer,
  teamColor,
  teamName,
  roundEndsAt,
}: QuestionViewProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 px-4 py-8 min-h-[60vh]">
      {/* Timer and Question */}
      <div className="flex flex-col items-center space-y-6">
        {/* Circular Timer */}
        <CircularTimer endTime={roundEndsAt} duration={20} size={75} />
        
        {/* Question Text */}
        <h2 className="text-3xl font-bold text-center text-text-primary px-4 leading-tight max-w-2xl" style={{ fontSize: '40px' }}>
          {question}
        </h2>
      </div>

      {/* Answer Buttons */}
      <div className="w-full max-w-md space-y-4">
        {answers.map((answer, index) => (
          <button
            key={index}
            onClick={() => onAnswer(index)}
            disabled={selectedAnswer !== null}
            className={`w-full py-7 px-6 rounded-2xl text-xl font-semibold text-center transition-all active:scale-[0.98] min-h-[72px] flex items-center justify-center ${
              selectedAnswer === index
                ? `text-white shadow-lg`
                : "bg-surface text-text-primary-dark shadow-md border-2 border-transparent"
            }`}
            style={
              selectedAnswer === index
                ? { backgroundColor: teamColor }
                : undefined
            }
          >
            {answer}
          </button>
        ))}
      </div>
    </div>
  );
}

