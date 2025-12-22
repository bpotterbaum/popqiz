"use client";

import { useState, useEffect } from "react";

interface ResultIndicatorProps {
  isCorrect: boolean;
  size?: number;
}

export default function ResultIndicator({
  isCorrect,
  size = 75,
}: ResultIndicatorProps) {
  const correctMessages = [
    "Nice work!",
    "You got it!",
    "Well done",
    "Good call",
  ];
  
  const incorrectMessages = [
    "Nice try",
    "Almost!",
    "Oof 😅",
    "Not quite",
  ];

  // Select a random message once when isCorrect changes (not rotating)
  const [selectedMessage, setSelectedMessage] = useState(() => {
    const messages = isCorrect ? correctMessages : incorrectMessages;
    return messages[Math.floor(Math.random() * messages.length)];
  });

  useEffect(() => {
    // When isCorrect changes, select a new random message
    const messages = isCorrect ? correctMessages : incorrectMessages;
    setSelectedMessage(messages[Math.floor(Math.random() * messages.length)]);
  }, [isCorrect]);

  const color = isCorrect ? "#22C55E" : "#E63946"; // green or red
  const icon = isCorrect ? "✓" : "✕";

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div
        className="rounded-full flex items-center justify-center font-bold text-white shadow-lg flex-shrink-0"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          fontSize: size * 0.5,
        }}
      >
        {icon}
      </div>
      <p
        className="text-xs font-semibold text-center"
        style={{ color }}
      >
        {selectedMessage}
      </p>
    </div>
  );
}
