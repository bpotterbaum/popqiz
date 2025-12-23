"use client";

import { useEffect, useState } from "react";

interface CircularTimerProps {
  endTime: string | null; // ISO timestamp
  duration: number; // Total duration in seconds (default 20)
  size?: number; // Size of the circle in pixels
}

export default function CircularTimer({
  endTime,
  duration = 20,
  size = 120,
}: CircularTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(() => {
    // Initialize with current remaining time if endTime exists
    if (!endTime) return duration;
    const now = new Date().getTime();
    const end = new Date(endTime).getTime();
    const remaining = Math.max(0, Math.floor((end - now) / 1000));
    // Don't cap at duration - use actual remaining time, but don't go below 0
    return remaining;
  });

  useEffect(() => {
    if (!endTime) {
      setTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const remaining = Math.max(0, Math.floor((end - now) / 1000));
      // Use actual remaining time, not capped at duration
      setTimeRemaining(remaining);
    };

    // Update immediately to sync with endTime
    updateTimer();

    // Update every 100ms for smoother animation
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [endTime, duration]);

  // Calculate progress based on actual time remaining vs duration
  const progress = endTime ? Math.max(0, Math.min(1, timeRemaining / duration)) : 0;
  
  // Radius calculation: account for stroke width (6px) - half on each side
  const radius = size / 2 - 3; // 3px for half stroke width
  const circumference = 2 * Math.PI * radius;
  
  // strokeDashoffset: 0 = full circle visible, circumference = completely offset
  // We want: progress 1.0 → offset 0 (full), progress 0 → offset circumference (empty)
  const strokeDashoffset = circumference * (1 - progress);

  // Color based on time remaining
  const getColor = () => {
    if (progress > 0.5) return "#6366F1"; // brand color
    if (progress > 0.25) return "#FBBF24"; // gold/warning
    return "#FB7185"; // peach/danger
  };

  const color = getColor();

  return (
    <div 
      className="relative flex items-center justify-center" 
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth="6"
          fill="none"
          opacity={0.3}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-100 ease-linear"
          style={{ filter: "drop-shadow(0 0 8px " + color + "40)" }}
        />
      </svg>
      {/* Time text - perfectly centered */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <span
          className="text-sm font-bold tabular-nums"
          style={{
            color: timeRemaining <= 5 ? "#FB7185" : timeRemaining <= 10 ? "#FBBF24" : "#FFFFFF",
            transition: "color 0.3s ease",
            lineHeight: 1,
            display: "block",
            textAlign: "center",
            margin: 0,
            padding: 0,
          }}
        >
          {timeRemaining}
        </span>
      </div>
    </div>
  );
}

