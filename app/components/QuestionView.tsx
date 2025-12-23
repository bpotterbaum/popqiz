"use client";

import { useEffect, useState } from "react";
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
  explanation?: string; // Optional explanation to display during reveal
  shouldFadeAnswers?: boolean; // Whether answers should fade out
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
  explanation,
  shouldFadeAnswers = false,
}: QuestionViewProps) {
  const isCorrect = selectedAnswer !== null && selectedAnswer === correctAnswerIndex;
  const [answersOpacity, setAnswersOpacity] = useState(1);

  // Handle fading out answers
  useEffect(() => {
    if (shouldFadeAnswers && isRevealPhase) {
      // Start fade after a brief delay to let users see the highlights
      const fadeTimer = setTimeout(() => {
        setAnswersOpacity(0);
      }, 2000); // Show highlights for 2 seconds, then fade
      return () => clearTimeout(fadeTimer);
    } else {
      setAnswersOpacity(1);
    }
  }, [shouldFadeAnswers, isRevealPhase]);

  return (
    <div className="flex flex-col items-center justify-center space-y-3 px-4 py-2 w-full max-h-full overflow-hidden">
      {/* Timer/Result Indicator/Explanation and Question */}
      <div className="flex flex-col items-center space-y-3 flex-shrink-0 w-full">
        {/* During reveal with explanation: show explanation instead of timer/result */}
        {isRevealPhase && explanation ? (
          <div className="w-full max-w-2xl px-2">
            <div className="px-4 py-3 bg-surface-secondary/50 rounded-xl border border-text-secondary/20 w-full">
              <p className="text-sm sm:text-base text-text-primary text-center leading-relaxed">
                {explanation}
              </p>
            </div>
          </div>
        ) : isRevealPhase ? (
          // Show Result Indicator during reveal (if player answered), Timer otherwise
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
      <div 
        className="w-full max-w-md space-y-2 flex-shrink-0 min-h-0 transition-opacity duration-1000"
        style={{ opacity: answersOpacity }}
      >
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

