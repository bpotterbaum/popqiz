"use client";

import { useEffect, useState } from "react";
import { getTextColorForBackground } from "@/lib/utils";

interface Team {
  name: string;
  score: number;
  color: string;
}

interface LeaderboardViewProps {
  teams: Team[];
  roundWinner?: string;
  previousScores?: Map<string, number>;
  explanation?: string; // Optional explanation to display persistently
  nextRoundEndsAt?: string | null; // End time for next round (for countdown timer)
  showTimer?: boolean; // Whether to show the timer (during reveal phase)
  compact?: boolean; // If true, render without wrapper padding (for absolute positioning)
}

export default function LeaderboardView({
  teams,
  roundWinner,
  previousScores = new Map(),
  explanation,
  nextRoundEndsAt,
  showTimer = true,
  compact = false,
}: LeaderboardViewProps) {
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const [highlightedTeams, setHighlightedTeams] = useState<Set<string>>(new Set());
  const [countdown, setCountdown] = useState(5);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatedScores, setAnimatedScores] = useState<Map<string, number>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Calculate time remaining for next round if nextRoundEndsAt is provided
  useEffect(() => {
    if (!nextRoundEndsAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTimeRemaining = () => {
      const now = new Date().getTime();
      const end = new Date(nextRoundEndsAt).getTime();
      const remaining = Math.max(0, Math.ceil((end - now) / 1000));
      setTimeRemaining(remaining);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [nextRoundEndsAt]);

  // Countdown timer (fallback if no nextRoundEndsAt)
  useEffect(() => {
    if (nextRoundEndsAt) return; // Use nextRoundEndsAt timer instead

    setCountdown(5);
    setIsAnimating(false);

    // Trigger initial animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 300);
          return 0;
        }
        setIsAnimating(true);
        // Reset animation flag after animation completes
        setTimeout(() => setIsAnimating(false), 400);
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [teams, nextRoundEndsAt]); // Reset countdown when teams change (new round)

  // Calculate score changes and highlight teams that gained points
  useEffect(() => {
    const newHighlights = new Set<string>();
    const newAnimatedScores = new Map<string, number>();
    const animationIntervals: NodeJS.Timeout[] = [];
    
    sortedTeams.forEach((team) => {
      const previousScore = previousScores.get(team.name) || 0;
      const currentScore = team.score;
      const pointsToAdd = currentScore - previousScore;
      
      // Only animate if NEW POINTS were added (player got answer correct)
      // If no new points, show the score immediately without animation
      if (pointsToAdd > 0) {
        // Player got points - animate the new points being added
        newHighlights.add(team.name);
        
        // Start from previous score and animate up to current score
        newAnimatedScores.set(team.name, previousScore);
        
        // Animate only the NEW points being added
        const duration = 800; // ms
        const steps = 30;
        const stepDuration = duration / steps;
        const stepIncrement = pointsToAdd / steps;
        
        let currentStep = 0;
        const animateInterval = setInterval(() => {
          currentStep++;
          const newScore = Math.min(
            previousScore + stepIncrement * currentStep,
            currentScore
          );
          setAnimatedScores((prev) => {
            const updated = new Map(prev);
            updated.set(team.name, Math.round(newScore));
            return updated;
          });
          
          if (currentStep >= steps) {
            clearInterval(animateInterval);
            setAnimatedScores((prev) => {
              const updated = new Map(prev);
              updated.set(team.name, currentScore);
              return updated;
            });
          }
        }, stepDuration);
        
        animationIntervals.push(animateInterval);
      } else {
        // No new points added (wrong answer or no answer)
        // Show the score immediately - NO ANIMATION
        newAnimatedScores.set(team.name, currentScore);
      }
    });
    
    setHighlightedTeams(newHighlights);
    setAnimatedScores(newAnimatedScores);

    // Remove highlight after animation
    const timer = setTimeout(() => {
      setHighlightedTeams(new Set());
    }, 2000);

    // Cleanup animation intervals and timer on unmount or when dependencies change
    return () => {
      animationIntervals.forEach(interval => clearInterval(interval));
      clearTimeout(timer);
    };
  }, [teams, previousScores]);

  const getPointsGained = (teamName: string): number => {
    const previousScore = previousScores.get(teamName) || 0;
    const currentTeam = teams.find((t) => t.name === teamName);
    if (!currentTeam) return 0;
    return Math.max(0, currentTeam.score - previousScore);
  };

  // Determine what countdown value to show
  const displayCountdown = timeRemaining !== null ? timeRemaining : countdown;

  const containerClasses = compact 
    ? "flex flex-col items-center justify-center w-full"
    : "flex flex-col items-center justify-center px-4 py-6 min-h-[60vh] w-full max-w-md mx-auto";

  return (
    <div className={containerClasses}>
      {/* Explanation - replaces title/timer when provided */}
      {explanation && (
        <div className="w-full max-w-2xl px-2 mb-6">
          <div className="px-4 py-3 bg-surface-secondary/50 rounded-xl border border-text-secondary/20 w-full">
            <p className="text-sm sm:text-base text-text-primary text-center leading-relaxed">
              {explanation}
            </p>
          </div>
        </div>
      )}

      {/* Leaderboard Title - only show if no explanation */}
      {!explanation && (
        <h2 className="text-lg font-bold text-text-primary mb-6">Round Results</h2>
      )}

      {/* Leaderboard */}
      <div className="w-full space-y-4 mb-8">
        {sortedTeams.map((team, index) => {
          const pointsGained = getPointsGained(team.name);
          const isHighlighted = highlightedTeams.has(team.name);
          const isWinner = roundWinner === team.name;

          // Calculate a darker/lighter version of team color for contrast
          const getRankText = () => {
            if (index === 0) return "1st";
            if (index === 1) return "2nd";
            if (index === 2) return "3rd";
            return `${index + 1}th`;
          };

          // Determine text color based on background for readability
          const textColor = getTextColorForBackground(team.color);
          const isLightBackground = textColor === '#1F2937';

          return (
            <div
              key={team.name}
              className={`rounded-2xl shadow-lg flex items-center transition-all duration-500 ${
                isHighlighted ? "scale-[1.02] ring-4" : ""
              }`}
              style={{
                backgroundColor: team.color,
                transform: isHighlighted ? "scale(1.02)" : "scale(1)",
                boxShadow: isHighlighted
                  ? `0 0 0 4px ${team.color}80, 0 12px 24px -6px rgba(0, 0, 0, 0.25)`
                  : "0 8px 16px -4px rgba(0, 0, 0, 0.2)",
                padding: "1.25rem 1.5rem",
              }}
            >
              {/* Left section: Rank and Team Info */}
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                {/* Rank indicator */}
                <div className="flex-shrink-0">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold shadow-md"
                    style={{
                      backgroundColor: isLightBackground ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.25)",
                      backdropFilter: "blur(8px)",
                      color: textColor,
                    }}
                  >
                    <span className="text-sm font-bold">
                      {getRankText()}
                    </span>
                  </div>
                </div>

                {/* Team name */}
                <span 
                  className="text-xl font-bold truncate drop-shadow-sm"
                  style={{ color: textColor }}
                >
                  {team.name}
                </span>
              </div>

              {/* Right section: Points */}
              <div className="flex-shrink-0 ml-4 flex flex-col items-end justify-center">
                {/* Points earned this round */}
                {pointsGained > 0 && (
                  <div className="mb-2">
                    <div
                      className="rounded-lg px-3 py-1.5 font-bold text-sm animate-pulse flex items-center shadow-lg"
                      style={{
                        backgroundColor: isLightBackground ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.95)",
                        color: isLightBackground ? textColor : team.color,
                      }}
                    >
                      +{pointsGained} points
                    </div>
                  </div>
                )}
                
                {/* Total score - animated */}
                <span
                  className={`text-3xl font-bold tabular-nums drop-shadow-md transition-all duration-300 ${
                    isHighlighted ? "scale-110" : ""
                  }`}
                  style={{ color: textColor }}
                >
                  {animatedScores.get(team.name) ?? team.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Next question countdown - only show if no explanation (explanation replaces timer) */}
      {showTimer && !explanation && (
        <div className="mt-auto flex flex-col items-center space-y-2 pt-4">
          <p className="text-text-secondary text-xs font-medium opacity-70">
            Next question in
          </p>
          <div
            className={`text-3xl font-semibold tabular-nums transition-all opacity-80 ${
              isAnimating ? "text-brand" : "text-text-secondary"
            }`}
            style={{
              transform: isAnimating ? "scale(1.2)" : "scale(1)",
              transition: "all 0.3s ease-out",
            }}
          >
            {displayCountdown > 0 ? displayCountdown : "..."}
          </div>
        </div>
      )}
    </div>
  );
}

