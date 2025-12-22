"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getOrCreateDeviceId } from "@/lib/utils";

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(errorParam);
    }

    // Auto-fill room code from URL parameter
    const codeParam = searchParams.get("code");
    if (codeParam) {
      setRoomCode(codeParam.toUpperCase());
    }
  }, [searchParams]);

  const handleJoin = async () => {
    if (roomCode.trim().length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const deviceId = getOrCreateDeviceId();
      const response = await fetch("/api/rooms/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": deviceId,
        },
        body: JSON.stringify({ code: roomCode.toUpperCase() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to join room");
      }

      const data = await response.json();
      router.push(`/room/${data.room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col px-4 py-8">
      <div className="w-full max-w-md mx-auto space-y-8 flex-1 flex flex-col justify-center">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-text-primary mb-8">
          Join a Popqiz
        </h1>

        {/* Room Code Input */}
        <div className="space-y-4">
          <label htmlFor="roomCode" className="block text-text-secondary text-sm font-medium">
            Room Code
          </label>
          <input
            id="roomCode"
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            className="w-full bg-surface text-text-primary text-2xl font-bold py-5 px-6 rounded-2xl border-2 border-text-secondary/20 focus:border-brand focus:outline-none text-center tracking-wider uppercase"
            maxLength={6}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleJoin();
              }
            }}
            autoFocus
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-warning/10 text-warning px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Join Button */}
        <button
          onClick={handleJoin}
          disabled={roomCode.trim().length === 0 || loading}
          className="w-full bg-brand text-white text-xl font-semibold py-5 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Joining..." : "Join Game"}
        </button>

        {/* Back link */}
        <Link
          href="/"
          className="text-center text-text-secondary hover:text-text-primary transition-colors"
        >
          ← Back
        </Link>
      </div>
    </main>
  );
}

