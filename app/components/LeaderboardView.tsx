"use client";

import { useEffect, useState } from "react";

interface Team {
  name: string;
  score: number;
  color: string;
}

interface LeaderboardViewProps {
  teams: Team[];
  roundWinner?: string;
  previousScores?: Map<string, number>;
}

export default function LeaderboardView({
  teams,
  roundWinner,
  previousScores = new Map(),
}: LeaderboardViewProps) {
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const [highlightedTeams, setHighlightedTeams] = useState<Set<string>>(new Set());
  const [countdown, setCountdown] = useState(3);
  const [isAnimating, setIsAnimating] = useState(false);

  // Countdown timer
  useEffect(() => {
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
  }, [teams]); // Reset countdown when teams change (new round)

  // Calculate score changes and highlight teams that gained points
  useEffect(() => {
    const newHighlights = new Set<string>();
    sortedTeams.forEach((team) => {
      const previousScore = previousScores.get(team.name) || 0;
      if (team.score > previousScore) {
        newHighlights.add(team.name);
      }
    });
    setHighlightedTeams(newHighlights);

    // Remove highlight after animation
    const timer = setTimeout(() => {
      setHighlightedTeams(new Set());
    }, 2000);

    return () => clearTimeout(timer);
  }, [teams, previousScores]);

  const getPointsGained = (teamName: string): number => {
    const previousScore = previousScores.get(teamName) || 0;
    const currentTeam = teams.find((t) => t.name === teamName);
    if (!currentTeam) return 0;
    return Math.max(0, currentTeam.score - previousScore);
  };

  return (
    <div className="flex flex-col items-center justify-center px-4 py-6 min-h-[60vh] w-full max-w-md mx-auto">
      {/* Leaderboard Title */}
      <h2 className="text-2xl font-bold text-text-primary mb-6">Round Results</h2>

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
                ringColor: team.color,
              }}
            >
              {/* Left section: Rank and Team Info */}
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                {/* Rank indicator */}
                <div className="flex-shrink-0">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-md"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.25)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <span className="text-sm font-bold">
                      {getRankText()}
                    </span>
                  </div>
                </div>

                {/* Team name */}
                <span className="text-xl font-bold text-white truncate drop-shadow-sm">
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
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        color: team.color,
                      }}
                    >
                      +{pointsGained} points
                    </div>
                  </div>
                )}
                
                {/* Total score */}
                <span
                  className={`text-3xl font-bold tabular-nums text-white drop-shadow-md transition-all duration-300 ${
                    isHighlighted ? "scale-110" : ""
                  }`}
                >
                  {team.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Next question countdown */}
      <div className="mt-auto flex flex-col items-center space-y-3 pt-4">
        <p className="text-text-secondary text-sm font-medium">
          Next question in
        </p>
        <div
          className={`text-5xl font-bold tabular-nums transition-all ${
            isAnimating ? "text-brand" : "text-text-primary"
          }`}
          style={{
            transform: isAnimating ? "scale(1.3)" : "scale(1)",
            transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {countdown > 0 ? countdown : "..."}
        </div>
      </div>
    </div>
  );
}

