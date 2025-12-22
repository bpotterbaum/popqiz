"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getOrCreateDeviceId } from "@/lib/utils";

type AgeRange = "kids" | "tweens" | "family" | "adults";

export default function StartPage() {
  const router = useRouter();
  const [ageRange, setAgeRange] = useState<AgeRange>("family");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartGame = async () => {
    setLoading(true);
    setError(null);

    try {
      const deviceId = getOrCreateDeviceId();
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": deviceId,
        },
        body: JSON.stringify({ age_band: ageRange }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create room");
      }

      const data = await response.json();
      router.push(`/room/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col px-4 py-8">
      <div className="w-full max-w-md mx-auto space-y-8 flex-1 flex flex-col justify-center">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-text-primary mb-8">
          Who&apos;s playing?
        </h1>

        {/* Age Range Selector */}
        <div className="bg-surface rounded-2xl p-2 shadow-sm">
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: "kids", label: "Kids", sublabel: "6-9" },
              { value: "tweens", label: "Tweens", sublabel: "10-13" },
              { value: "family", label: "Family", sublabel: "" },
              { value: "adults", label: "Adults", sublabel: "" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setAgeRange(option.value as AgeRange)}
                className={`py-4 px-2 rounded-xl text-sm font-medium transition-all ${
                  ageRange === option.value
                    ? "bg-brand text-white shadow-md"
                    : "bg-transparent text-text-secondary-dark"
                }`}
              >
                <div>{option.label}</div>
                {option.sublabel && (
                  <div className="text-xs mt-1 opacity-80">{option.sublabel}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-warning/10 text-warning px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Start Game Button */}
        <button
          onClick={handleStartGame}
          disabled={loading}
          className="w-full bg-brand text-white text-xl font-semibold py-5 px-6 rounded-2xl shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Starting..." : "Start Game"}
        </button>

        {/* Back link */}
        <Link
          href="/"
          className="text-center text-text-secondary"
        >
          ← Back
        </Link>
      </div>
    </main>
  );
}

