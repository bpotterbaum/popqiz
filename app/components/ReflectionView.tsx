"use client";

import { useEffect, useMemo, useState } from "react";
import LeaderboardView from "./LeaderboardView";
import ResultIndicator from "./ResultIndicator";
import { getTextColorForBackground } from "@/lib/utils";

type ReflectionQuestion = {
  question: string;
  answers: string[];
  correctAnswerIndex: number | null;
  selectedAnswer: number | null;
  explanation?: string;
};

type Team = {
  name: string;
  score: number;
  color: string;
};

type ReflectionViewProps = {
  reflectionStartedAtMs: number;
  question: ReflectionQuestion | null;
  teams: Team[];
  roundWinner?: string;
  previousScores?: Map<string, number>;
  teamColor: string;
};

type Stage = "reveal" | "answers_fade" | "leaderboard";

// Simplified timing: Total reflection period is 12 seconds
// - 0-2.5s: Show result + answers with correct highlighted (reveal)
// - 2.5-3.5s: Fade out all answers smoothly
// - 3.5-12s: Show leaderboard (with score animations and time to read context)
const REVEAL_MS = 2500;
const ANSWERS_FADE_MS = 1000;
const LEADERBOARD_ENTER_MS = 400;

export default function ReflectionView({
  reflectionStartedAtMs,
  question,
  teams,
  roundWinner,
  previousScores,
  teamColor,
}: ReflectionViewProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  const stage: Stage = useMemo(() => {
    const elapsed = nowMs - reflectionStartedAtMs;
    if (elapsed < REVEAL_MS) return "reveal";
    if (elapsed < REVEAL_MS + ANSWERS_FADE_MS) return "answers_fade";
    return "leaderboard";
  }, [nowMs, reflectionStartedAtMs]);

  const isCorrect =
    question?.selectedAnswer != null &&
    question?.correctAnswerIndex != null &&
    question.selectedAnswer === question.correctAnswerIndex;

  const showAnswers = stage === "reveal" || stage === "answers_fade";
  const showLeaderboard = stage === "leaderboard";

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {/* Top: Result indicator + explanation (pinned, scrollable) */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center space-y-3">
          {/* Result indicator */}
          {question?.selectedAnswer != null && question?.correctAnswerIndex != null ? (
            <ResultIndicator isCorrect={!!isCorrect} size={60} />
          ) : question?.correctAnswerIndex != null ? (
            <div className="h-[60px]" />
          ) : null}
          
          {/* Explanation (replaces question) */}
          {question?.explanation ? (
            <div className="px-4 py-3 bg-surface-secondary/50 rounded-xl border border-text-secondary/20 w-full">
              <p className="text-sm sm:text-base text-text-primary text-center leading-relaxed">
                {question.explanation}
              </p>
            </div>
          ) : (
            <div className="px-4 py-3 bg-surface-secondary/30 rounded-xl border border-text-secondary/10 w-full">
              <p className="text-sm sm:text-base text-text-secondary text-center leading-relaxed">
                Get ready for the next one…
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Middle: answers -> leaderboard morph */}
      <div className="px-4 py-4">
        <div className="w-full max-w-md mx-auto relative">
          {/* Answers panel - shows with correct highlighted, then fades all away */}
          <div
            className="transition-opacity"
            style={{
              opacity: showAnswers ? 1 : 0,
              transition: "opacity 600ms ease",
              pointerEvents: showAnswers ? "auto" : "none",
            }}
          >
            <div className="space-y-2">
              {(question?.answers || []).map((answer, index) => {
                const correctIdx = question?.correctAnswerIndex ?? null;
                const selectedIdx = question?.selectedAnswer ?? null;

                const isSelected = selectedIdx === index;
                const isCorrectAnswer = correctIdx !== null && index === correctIdx;
                const isWrongSelected = isSelected && !isCorrectAnswer && correctIdx !== null;

                let buttonStyle: React.CSSProperties = {};
                let buttonClasses =
                  "w-full py-3 px-4 rounded-2xl text-base font-semibold text-center transition-all min-h-[56px] flex items-center justify-center ";

                if (correctIdx !== null) {
                  // Reveal styling - highlight correct answer
                  if (isCorrectAnswer && isSelected) {
                    buttonStyle = {
                      backgroundColor: "#22C55E",
                      color: "#FFFFFF",
                      border: "3px solid #16A34A",
                      transform: "scale(1.05)",
                    };
                    buttonClasses += "shadow-lg";
                  } else if (isCorrectAnswer) {
                    buttonStyle = { 
                      backgroundColor: "#22C55E", 
                      color: "#FFFFFF",
                    };
                    buttonClasses += "shadow-lg";
                  } else if (isWrongSelected) {
                    const textColor = getTextColorForBackground(teamColor);
                    buttonStyle = {
                      backgroundColor: teamColor,
                      color: textColor,
                      border: "3px solid #E63946",
                      opacity: 0.75,
                    };
                    buttonClasses += "shadow-md";
                  } else {
                    // Other incorrect answers - dimmed
                    buttonStyle = {
                      opacity: 0.35,
                      backgroundColor: "#FFFFFF",
                      color: "#1F2937",
                    };
                    buttonClasses += "shadow-md border-2 border-transparent";
                  }
                } else {
                  // No correct index yet (shouldn't happen normally)
                  buttonClasses += "bg-surface text-text-primary-dark shadow-md border-2 border-transparent";
                }

                return (
                  <button
                    key={index}
                    className={buttonClasses + " cursor-default"}
                    style={buttonStyle}
                    disabled
                  >
                    {answer}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leaderboard panel - fades in smoothly after answers fade, same position */}
          <div
            className="transition-opacity absolute top-0 left-0 right-0"
            style={{
              opacity: showLeaderboard ? 1 : 0,
              transition: `opacity 600ms ease ${LEADERBOARD_ENTER_MS}ms`,
              pointerEvents: showLeaderboard ? "auto" : "none",
            }}
          >
            {showLeaderboard && (
              <LeaderboardView
                teams={teams}
                roundWinner={roundWinner}
                previousScores={previousScores}
                showTimer={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


