"use client";

import { useEffect, useMemo, useState } from "react";

type BottomCountdownProps = {
  label?: string;
  targetTimeMs: number; // epoch millis
};

function clampSeconds(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000));
}

export default function BottomCountdown({
  label = "Next round begins in",
  targetTimeMs,
}: BottomCountdownProps) {
  const initial = useMemo(() => clampSeconds(targetTimeMs - Date.now()), [targetTimeMs]);
  const [seconds, setSeconds] = useState(initial);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    let raf: number | null = null;
    let interval: NodeJS.Timeout | null = null;

    const tick = () => {
      const next = clampSeconds(targetTimeMs - Date.now());
      setSeconds(next);
      setIsAnimating(true);
      // Let the CSS transition do the work; reset flag quickly
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setIsAnimating(false));
    };

    tick();
    interval = setInterval(tick, 250);

    return () => {
      if (interval) clearInterval(interval);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [targetTimeMs]);

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


