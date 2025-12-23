"use client";

import { useState } from "react";
import QuestionView from "@/app/components/QuestionView";

export default function TestQuestionsPage() {
  const [questionType, setQuestionType] = useState<"2" | "3" | "4">("3");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isRevealPhase, setIsRevealPhase] = useState(false);

  const testQuestions = {
    "2": {
      question: "This is a True/False test question. The answer is True.",
      answers: ["True", "False"],
      correctIndex: 0,
    },
    "3": {
      question: "This is a test question with 3 answer choices. Which is correct?",
      answers: ["First choice (wrong)", "Second choice (correct)", "Third choice (wrong)"],
      correctIndex: 1,
    },
    "4": {
      question: "This is a test question with 4 answer choices. Which is correct?",
      answers: [
        "First choice (wrong)",
        "Second choice (correct)",
        "Third choice (wrong)",
        "Fourth choice (wrong)",
      ],
      correctIndex: 1,
    },
  };

  const currentQuestion = testQuestions[questionType];
  const roundEndsAt = isRevealPhase ? null : new Date(Date.now() + 20000).toISOString();

  const handleAnswer = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    // Auto-enter reveal phase after a moment
    setTimeout(() => {
      setIsRevealPhase(true);
    }, 500);
  };

  const resetQuestion = () => {
    setSelectedAnswer(null);
    setIsRevealPhase(false);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-text-primary mb-6">Question UI Test</h1>

        {/* Question Type Selector */}
        <div className="mb-6 p-4 bg-surface rounded-lg">
          <label className="block text-text-primary-dark font-semibold mb-2">
            Select Question Type:
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setQuestionType("2");
                resetQuestion();
              }}
              className={`px-4 py-2 rounded-lg font-medium ${
                questionType === "2"
                  ? "bg-primary text-white"
                  : "bg-surface-secondary text-text-primary-dark"
              }`}
            >
              2 Choices (True/False)
            </button>
            <button
              onClick={() => {
                setQuestionType("3");
                resetQuestion();
              }}
              className={`px-4 py-2 rounded-lg font-medium ${
                questionType === "3"
                  ? "bg-primary text-white"
                  : "bg-surface-secondary text-text-primary-dark"
              }`}
            >
              3 Choices
            </button>
            <button
              onClick={() => {
                setQuestionType("4");
                resetQuestion();
              }}
              className={`px-4 py-2 rounded-lg font-medium ${
                questionType === "4"
                  ? "bg-primary text-white"
                  : "bg-surface-secondary text-text-primary-dark"
              }`}
            >
              4 Choices
            </button>
          </div>
        </div>

        {/* Reset Button */}
        <div className="mb-4">
          <button
            onClick={resetQuestion}
            className="px-4 py-2 bg-surface-secondary text-text-primary-dark rounded-lg hover:bg-surface-secondary/80"
          >
            Reset Question State
          </button>
        </div>

        {/* Question Display */}
        <div className="bg-surface rounded-lg p-6 min-h-[400px] flex items-center justify-center">
          <div className="w-full max-w-2xl">
            <QuestionView
              question={currentQuestion.question}
              answers={currentQuestion.answers}
              onAnswer={handleAnswer}
              selectedAnswer={selectedAnswer}
              teamColor="#FFD700" // Yellow for testing
              teamName="Test Team"
              roundEndsAt={roundEndsAt}
              correctAnswerIndex={isRevealPhase ? currentQuestion.correctIndex : null}
              isRevealPhase={isRevealPhase}
            />
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-6 p-4 bg-surface rounded-lg">
          <h2 className="text-xl font-semibold text-text-primary-dark mb-2">Test Info</h2>
          <ul className="list-disc list-inside space-y-1 text-text-secondary">
            <li>Question Type: {questionType} choices</li>
            <li>Selected Answer: {selectedAnswer !== null ? selectedAnswer : "None"}</li>
            <li>Reveal Phase: {isRevealPhase ? "Yes" : "No"}</li>
            <li>Correct Answer Index: {currentQuestion.correctIndex}</li>
            <li>Is Correct: {selectedAnswer === currentQuestion.correctIndex ? "Yes" : "No"}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

