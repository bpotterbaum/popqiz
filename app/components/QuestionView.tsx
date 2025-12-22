"use client";

import CircularTimer from "./CircularTimer";
import ResultIndicator from "./ResultIndicator";
import { getTextColorForBackground } from "@/lib/utils";

interface QuestionViewProps {
  question: string;
  answers: string[];
  onAnswer: (answerIndex: number) => void;
  selectedAnswer: number | null;
  teamColor: string;
  teamName: string;
  roundEndsAt: string | null;
  correctAnswerIndex?: number | null; // For reveal phase
  isRevealPhase?: boolean; // Whether we're in reveal phase
}

export default function QuestionView({
  question,
  answers,
  onAnswer,
  selectedAnswer,
  teamColor,
  teamName,
  roundEndsAt,
  correctAnswerIndex = null,
  isRevealPhase = false,
}: QuestionViewProps) {
  const isCorrect = selectedAnswer !== null && selectedAnswer === correctAnswerIndex;

  return (
    <div className="flex flex-col items-center justify-center space-y-3 px-4 py-2 w-full max-h-full overflow-hidden">
      {/* Timer/Result Indicator and Question */}
      <div className="flex flex-col items-center space-y-3 flex-shrink-0">
        {/* Show Result Indicator during reveal (if player answered), Timer otherwise */}
        {isRevealPhase ? (
          selectedAnswer !== null ? (
            <ResultIndicator isCorrect={isCorrect} size={60} />
          ) : (
            // Show timer during reveal if player hasn't answered yet (edge case)
            <CircularTimer endTime={roundEndsAt} duration={20} size={60} />
          )
        ) : (
          <CircularTimer endTime={roundEndsAt} duration={20} size={60} />
        )}
        
        {/* Question Text */}
        <h2 className="text-lg sm:text-xl font-bold text-center text-text-primary px-2 leading-tight max-w-2xl">
          {question}
        </h2>
      </div>

      {/* Answer Buttons */}
      <div className="w-full max-w-md space-y-2 flex-shrink-0 min-h-0">
        {answers.map((answer, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrectAnswer = correctAnswerIndex !== null && index === correctAnswerIndex;
          const isWrongSelected = isRevealPhase && isSelected && !isCorrectAnswer;

          // Determine styling based on reveal phase
          let buttonStyle: React.CSSProperties = {};
          let buttonClasses = "w-full py-3 px-4 rounded-2xl text-base font-semibold text-center transition-all min-h-[56px] flex items-center justify-center ";

          if (isRevealPhase) {
            // Reveal phase: highlight correct, fade incorrect, style selected
            if (isCorrectAnswer && isSelected) {
              // Correct answer that was selected: green background with green outline, scale up
              buttonStyle = {
                backgroundColor: "#22C55E",
                color: "#FFFFFF",
                border: "3px solid #16A34A", // Darker green for outline
                transform: "scale(1.05)",
              };
              buttonClasses += "shadow-lg";
            } else if (isCorrectAnswer) {
              // Correct answer (not selected): green, full opacity, white text - ALWAYS visible
              buttonStyle = { backgroundColor: "#22C55E", color: "#FFFFFF" };
              buttonClasses += "shadow-lg";
            } else if (isWrongSelected) {
              // Wrong selected answer: team color background with red outline, dimmed, ensure text is visible
              const textColor = getTextColorForBackground(teamColor);
              buttonStyle = {
                backgroundColor: teamColor,
                color: textColor,
                border: "3px solid #E63946",
                transform: "scale(1)",
                opacity: 0.7,
              };
              buttonClasses += "shadow-md";
            } else {
              // Other incorrect answers: faded but still readable
              buttonStyle = { 
                opacity: 0.4,
                backgroundColor: "#FFFFFF",
                color: "#1F2937",
              };
              buttonClasses += "shadow-md border-2 border-transparent";
            }
            buttonClasses += " cursor-default";
          } else {
            // Normal phase: allow interaction
            if (isSelected) {
              // Selected: use team color with appropriate text color for contrast
              const textColor = getTextColorForBackground(teamColor);
              buttonStyle = { 
                backgroundColor: teamColor, 
                color: textColor,
              };
              buttonClasses += "shadow-lg";
            } else {
              buttonClasses += "bg-surface text-text-primary-dark shadow-md border-2 border-transparent";
            }
            if (selectedAnswer === null) {
              buttonClasses += " active:scale-[0.98]";
            } else {
              buttonClasses += " cursor-default";
            }
          }

          return (
            <button
              key={index}
              onClick={() => !isRevealPhase && selectedAnswer === null && onAnswer(index)}
              disabled={selectedAnswer !== null || isRevealPhase}
              className={buttonClasses}
              style={buttonStyle}
            >
              {answer}
            </button>
          );
        })}
      </div>
    </div>
  );
}

