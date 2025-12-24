"use client";

import { useEffect, useMemo, useState, useRef } from "react";

type BottomCountdownProps = {
  label?: string;
  targetTimeMs: number; // epoch millis
  onReachZero?: () => void;
};

function clampSeconds(ms: number) {
  // Use floor so it only shows 0 when we're actually at or past the target (at start of that second)
  // This prevents showing 0 while there's still time remaining
  return Math.max(0, Math.floor(ms / 1000));
}

export default function BottomCountdown({
  label = "Next round begins in",
  targetTimeMs,
  onReachZero,
}: BottomCountdownProps) {
  const initial = useMemo(() => clampSeconds(targetTimeMs - Date.now()), [targetTimeMs]);
  const [seconds, setSeconds] = useState(initial);
  const [isAnimating, setIsAnimating] = useState(false);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    let raf: number | null = null;
    let interval: NodeJS.Timeout | null = null;
    hasTriggeredRef.current = false;

    const tick = () => {
      const now = Date.now();
      const msRemaining = targetTimeMs - now;
      const next = clampSeconds(msRemaining);
      setSeconds(next);
      setIsAnimating(true);
      // Let the CSS transition do the work; reset flag quickly
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setIsAnimating(false));
      
      // Trigger callback when we reach 0 (only once)
      // Trigger when we've crossed the threshold (next is 0 and we're at or past target time)
      if (next === 0 && msRemaining <= 0 && !hasTriggeredRef.current && onReachZero) {
        hasTriggeredRef.current = true;
        onReachZero();
      }
    };

    tick();
    // Update more frequently for accuracy
    interval = setInterval(tick, 100);

    return () => {
      if (interval) clearInterval(interval);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [targetTimeMs, onReachZero]);

  return (
    <div className="w-full px-4 pb-4 pt-3 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl bg-surface/10 border border-text-secondary/15 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <span
          className={`text-2xl font-bold tabular-nums ${
            isAnimating ? "text-brand" : "text-text-primary"
          }`}
          style={{
            transform: isAnimating ? "scale(1.06)" : "scale(1)",
            transition: "all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {seconds}
        </span>
      </div>
    </div>
  );
}


