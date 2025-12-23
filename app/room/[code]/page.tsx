"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getOrCreateDeviceId, getTeamColorHex } from "@/lib/utils";
import QuestionView from "@/app/components/QuestionView";
import LeaderboardView from "@/app/components/LeaderboardView";
import InviteSheet from "@/app/components/InviteSheet";
import QuestionControlsSheet from "@/app/components/QuestionControlsSheet";
import MoreMenu from "@/app/components/MoreMenu";

type GameState = "loading" | "question" | "reveal" | "leaderboard";

interface Room {
  id: string;
  code: string;
  round_number: number;
  current_question_id: string | null;
  round_ends_at: string | null;
}

interface Player {
  id: string;
  team_name: string;
  team_color: string;
  score: number;
  created_at?: string;
}

interface Question {
  id: string;
  question: string;
  choices: string[];
  correct_index?: number;
  explanation?: string;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.code as string;

  const [gameState, setGameState] = useState<GameState>("loading");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const revealTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [myTeamColor, setMyTeamColor] = useState<string>("#6366F1");
  const [myTeamName, setMyTeamName] = useState<string>("");
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [questionControlsOpen, setQuestionControlsOpen] = useState(false);
  const [roundWinner, setRoundWinner] = useState<string | undefined>();
  const [previousRoundNumber, setPreviousRoundNumber] = useState(0);
  const [previousScores, setPreviousScores] = useState<Map<string, number>>(new Map());

  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const leaderboardTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const leaderboardStartTimeRef = useRef<number | null>(null);
  const roomRef = useRef<Room | null>(null);
  const gameStateRef = useRef<GameState>(gameState);
  const scoresBeforeScoringRef = useRef<Map<string, number>>(new Map());
  const nextQuestionIdRef = useRef<string | null>(null);
  const currentRoundEndsAtRef = useRef<string | null>(null);
  const preservedQuestionRef = useRef<Question | null>(null);
  const preservedSelectedAnswerRef = useRef<number | null>(null);
  const preservedCorrectAnswerIndexRef = useRef<number | null>(null);
  const deviceId = getOrCreateDeviceId();

  // Keep refs in sync
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Initialize: Join room or get existing player
  useEffect(() => {
    async function initialize() {
      try {
        const response = await fetch("/api/rooms/join", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-device-id": deviceId,
          },
          body: JSON.stringify({ code: roomCode }),
        });

        if (!response.ok) {
          const error = await response.json();
          if (response.status === 404) {
            router.push("/join?error=Room not found");
            return;
          }
          throw new Error(error.error || "Failed to join room");
        }

        const data = await response.json();
        setMyPlayerId(data.player.id);
        setMyTeamColor(getTeamColorHex(data.player.team_color));
        setMyTeamName(data.player.team_name);

        // Load initial room and players
        await loadRoomData(data.room.id);
        await loadPlayers(data.room.id);
      } catch (error) {
        console.error("Error initializing room:", error);
        router.push("/join?error=Failed to join room");
      }
    }

    initialize();
  }, [roomCode, deviceId, router]);

  // Load room data
  async function loadRoomData(roomId: string, preserveState: boolean = false) {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (error) {
      console.error("Error loading room:", error);
      return;
    }

    setRoom(data);
    setPreviousRoundNumber(data.round_number);

    // Load question if available
    if (data.current_question_id) {
      await loadQuestion(data.current_question_id);
      // Store the current round's end time for use during reveal phase
      currentRoundEndsAtRef.current = data.round_ends_at;
    }

    // Only determine game state if we're not preserving current state
    // (e.g., when showing leaderboard, we want to keep that state)
    if (!preserveState) {
      const now = new Date();
      const roundEndsAt = data.round_ends_at ? new Date(data.round_ends_at) : null;

      if (roundEndsAt && now < roundEndsAt) {
        setGameState("question");
      } else {
        setGameState("leaderboard");
      }
    }
  }

  // Load question
  async function loadQuestion(questionId: string) {
    const { data, error } = await supabase
      .from("question_cache")
      .select("id, question, choices, correct_index, explanation")
      .eq("id", questionId)
      .single();

    if (error) {
      console.error("Error loading question:", error);
      return;
    }

    setCurrentQuestion({
      id: data.id,
      question: data.question,
      choices: data.choices as string[],
      correct_index: data.correct_index,
      explanation: data.explanation || undefined,
    });
    
    // Store correct answer index for reveal phase
    if (data.correct_index !== undefined) {
      setCorrectAnswerIndex(data.correct_index);
    }
  }

  // Transition to question state (helper function)
  async function transitionToQuestion(questionId: string) {
    // Clear reveal phase data and preserved refs BEFORE loading new question
    // This is critical - if selectedAnswer is not null, checkRoundEnd will immediately transition to reveal
    setSelectedAnswer(null);
    setCorrectAnswerIndex(null);
    preservedQuestionRef.current = null;
    preservedSelectedAnswerRef.current = null;
    preservedCorrectAnswerIndexRef.current = null;
    
    // Set game state to question FIRST, before loading, to prevent checkRoundEnd from triggering
    setGameState("question");
    
    // Double-check we still have a question (room might have changed)
    const latestRoom = roomRef.current;
    if (latestRoom && latestRoom.current_question_id) {
      await loadQuestion(latestRoom.current_question_id);
      // Store the current round's end time for use during reveal phase
      currentRoundEndsAtRef.current = latestRoom.round_ends_at;
      // Clear previous scores for next round
      setPreviousScores(new Map());
    } else if (questionId) {
      // Fallback to original question ID
      await loadQuestion(questionId);
      // Store the current round's end time for use during reveal phase
      const latestRoom = roomRef.current;
      if (latestRoom) {
        currentRoundEndsAtRef.current = latestRoom.round_ends_at;
      }
      // Clear previous scores for next round
      setPreviousScores(new Map());
    }
    leaderboardTimeoutRef.current = null;
    leaderboardStartTimeRef.current = null;
  }

  // Load players
  async function loadPlayers(roomId: string) {
    const { data, error } = await supabase
      .from("players")
      .select("id, team_name, team_color, score, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading players:", error);
      return;
    }

    console.log(`Loaded ${data.length} players:`, data.map(p => `${p.team_name} (${p.team_color})`));

    // Update current player's team name and color if they changed
    if (myPlayerId) {
      const myPlayer = data.find((p) => p.id === myPlayerId);
      if (myPlayer) {
        setMyTeamName(myPlayer.team_name);
        setMyTeamColor(getTeamColorHex(myPlayer.team_color));
      }
    }

    // Store current scores before updating (in case we're about to show leaderboard)
    const currentScores = new Map<string, number>();
    data.forEach((p) => {
      currentScores.set(p.team_name, p.score);
    });
    
    // If we don't have previous scores stored yet, store these as baseline
    // (This captures scores before they get updated by scoring)
    if (scoresBeforeScoringRef.current.size === 0) {
      scoresBeforeScoringRef.current = currentScores;
    }

    // Sort by created_at for host detection, then map
    const sortedData = [...data].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aTime - bTime;
    });
    
    setPlayers(
      sortedData.map((p) => ({
        id: p.id,
        team_name: p.team_name,
        team_color: getTeamColorHex(p.team_color),
        score: p.score,
        created_at: p.created_at,
      }))
    );
  }

  // Set up real-time subscriptions
  useEffect(() => {
    if (!room) return;

    // Subscribe to room changes
    const roomSubscription = supabase
      .channel(`room:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        async (payload) => {
          const updatedRoom = payload.new as Room;
          const currentRoom = roomRef.current;
          
          if (!currentRoom) {
            setRoom(updatedRoom);
            return;
          }

          // Check if round advanced
          if (updatedRoom.round_number > currentRoom.round_number) {
            // Round advanced - use scores we captured before scoring happened
            // If we have scores from before scoring, use those; otherwise use current
            const scoresToUse = scoresBeforeScoringRef.current.size > 0 
              ? scoresBeforeScoringRef.current 
              : (() => {
                  const currentScores = new Map<string, number>();
                  players.forEach((p) => {
                    currentScores.set(p.team_name, p.score);
                  });
                  return currentScores;
                })();
            
            setPreviousScores(scoresToUse);
            previousScoresRef.current = scoresToUse;
            
            // Clear the ref for next round
            scoresBeforeScoringRef.current = new Map();

            setPreviousRoundNumber(updatedRoom.round_number);
            setRoundWinner(undefined);
            
            // Store the next question ID for use in timeouts
            if (updatedRoom.current_question_id) {
              nextQuestionIdRef.current = updatedRoom.current_question_id;
            }

            // Sequential flow: question -> reveal -> leaderboard -> next round
            // When round advances, we should show leaderboard for the round that just ended
            // Don't set up timeouts to load next question here - wait until we're actually in leaderboard
            if (gameStateRef.current === "reveal") {
              // Don't update question data, selectedAnswer, or correctAnswerIndex during reveal phase
              // Preserve them so user can finish reading the explanation
              // Just update the room state (for other data like scores)
              setRoom(updatedRoom);
              // Already in reveal phase - reset timeout to give full 7000ms for reading explanation
              if (revealTimeoutRef.current) {
                clearTimeout(revealTimeoutRef.current);
              }
              revealTimeoutRef.current = setTimeout(() => {
                setGameState("leaderboard");
                leaderboardStartTimeRef.current = Date.now();
                // Now set up timeout to load next question after showing leaderboard for 5 seconds
                const questionId = nextQuestionIdRef.current;
                if (questionId) {
                  // Clear any existing leaderboard timeout
                  if (leaderboardTimeoutRef.current) {
                    clearTimeout(leaderboardTimeoutRef.current);
                  }
                  leaderboardTimeoutRef.current = setTimeout(async () => {
                    await transitionToQuestion(questionId);
                  }, 5000);
                }
              }, 7000);
            } else if (gameStateRef.current === "question") {
              // We should have transitioned to reveal, but if we haven't, do it now
              // Then transition to leaderboard after reveal duration
              // Preserve current question data before transitioning
              preservedQuestionRef.current = currentQuestion;
              preservedSelectedAnswerRef.current = selectedAnswer;
              preservedCorrectAnswerIndexRef.current = correctAnswerIndex;
              setGameState("reveal");
              if (revealTimeoutRef.current) {
                clearTimeout(revealTimeoutRef.current);
              }
              revealTimeoutRef.current = setTimeout(() => {
                setGameState("leaderboard");
                leaderboardStartTimeRef.current = Date.now();
                // Now set up timeout to load next question after showing leaderboard for 5 seconds
                const questionId = nextQuestionIdRef.current;
                if (questionId) {
                  // Clear any existing leaderboard timeout
                  if (leaderboardTimeoutRef.current) {
                    clearTimeout(leaderboardTimeoutRef.current);
                  }
                  leaderboardTimeoutRef.current = setTimeout(async () => {
                    await transitionToQuestion(questionId);
                  }, 5000);
                }
              }, 7000);
              // Don't clear selectedAnswer or correctAnswerIndex yet - keep them for reveal phase
              setRoom(updatedRoom);
            } else if (gameStateRef.current === "leaderboard") {
              // Already in leaderboard - clear question data and set up timeout for next question
              setSelectedAnswer(null);
              setCorrectAnswerIndex(null);
              setRoom(updatedRoom);
              // If we don't have a timeout running, set one up
              // Otherwise, let the existing timeout continue (don't reset it)
              if (!leaderboardTimeoutRef.current && nextQuestionIdRef.current) {
                leaderboardStartTimeRef.current = Date.now();
                const questionId = nextQuestionIdRef.current;
                leaderboardTimeoutRef.current = setTimeout(async () => {
                  await transitionToQuestion(questionId);
                }, 5000);
              }
            }
          } else if (updatedRoom.current_question_id && updatedRoom.current_question_id !== currentRoom.current_question_id) {
            // Question changed (skip) - go directly to question
            // But only if we're not currently showing leaderboard with a timeout
            const isShowingLeaderboard = gameStateRef.current === "leaderboard" && 
                                       leaderboardTimeoutRef.current !== null &&
                                       leaderboardStartTimeRef.current !== null &&
                                       (Date.now() - leaderboardStartTimeRef.current) < 5000;
            if (!isShowingLeaderboard) {
              // Clear reveal phase data BEFORE loading new question
              // This is critical - if selectedAnswer is not null, checkRoundEnd will immediately transition to reveal
              setSelectedAnswer(null);
              setCorrectAnswerIndex(null);
              preservedQuestionRef.current = null;
              preservedSelectedAnswerRef.current = null;
              preservedCorrectAnswerIndexRef.current = null;
              // Set game state to question FIRST, before loading, to prevent checkRoundEnd from triggering
              setGameState("question");
              setRoom(updatedRoom);
              await loadQuestion(updatedRoom.current_question_id);
              // Store the current round's end time for use during reveal phase
              currentRoundEndsAtRef.current = updatedRoom.round_ends_at;
            } else {
              // We're showing leaderboard, just update room but don't change state
              setRoom(updatedRoom);
            }
          } else {
            // Just update room state (score changes, etc.)
            // Don't change gameState if we're showing leaderboard
            const isShowingLeaderboard = gameStateRef.current === "leaderboard" && 
                                       leaderboardTimeoutRef.current !== null &&
                                       leaderboardStartTimeRef.current !== null &&
                                       (Date.now() - leaderboardStartTimeRef.current) < 5000;
            if (!isShowingLeaderboard) {
              setRoom(updatedRoom);
            } else {
              // Just update room, don't change state
              setRoom(updatedRoom);
            }
          }
        }
      )
      .subscribe();

    // Subscribe to player changes
    const playersSubscription = supabase
      .channel(`players:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          console.log("Player change detected:", payload.eventType, payload.new);
          // Before loading new players, capture current scores if we're about to show leaderboard
          // This ensures we have the "before" state before scores update
          if (gameState === "question" && roomRef.current) {
            const currentScores = new Map<string, number>();
            players.forEach((p) => {
              currentScores.set(p.team_name, p.score);
            });
            // Only update if we don't already have previous scores (first time)
            if (previousScores.size === 0) {
              setPreviousScores(currentScores);
            }
          }
          loadPlayers(room.id);
        }
      )
      .subscribe();

    return () => {
      roomSubscription.unsubscribe();
      playersSubscription.unsubscribe();
      if (leaderboardTimeoutRef.current) {
        clearTimeout(leaderboardTimeoutRef.current);
      }
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
    };
  }, [room?.id]); // Only recreate subscription when room ID changes

  // Check for round end and transition to reveal phase
  useEffect(() => {
    if (!room || gameState !== "question" || !room.round_ends_at) return;

    const checkRoundEnd = () => {
      const now = new Date().getTime();
      const roundEndsAt = new Date(room.round_ends_at!).getTime();
      const timeRemaining = roundEndsAt - now;
      const timeExpired = timeRemaining <= 0;
      const timeAlmostExpired = timeRemaining <= 500; // Within 500ms of expiring

      // Show reveal phase if:
      // 1. Timer has expired, OR
      // 2. Player has answered (they want to see the result)
      const shouldShowReveal = timeExpired || selectedAnswer !== null;

      if (shouldShowReveal && gameStateRef.current === "question") {
        // Transition to reveal phase
        setGameState("reveal");
        
        // After 7000ms, the server tick will handle transition to leaderboard
        // But we set a timeout as backup
        if (revealTimeoutRef.current) {
          clearTimeout(revealTimeoutRef.current);
        }
        revealTimeoutRef.current = setTimeout(() => {
          // Transition to leaderboard after reveal duration
          if (gameStateRef.current === "reveal") {
            setGameState("leaderboard");
          }
        }, 7000);
      }
    };

    const interval = setInterval(checkRoundEnd, 100);
    checkRoundEnd(); // Check immediately

    return () => {
      clearInterval(interval);
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
    };
  }, [room, gameState, selectedAnswer]);

  // Set up tick interval (host pings server every 2s)
  useEffect(() => {
    if (!room || gameState === "loading") return;

    tickIntervalRef.current = setInterval(async () => {
      try {
        await fetch(`/api/rooms/${roomCode}/tick`, {
          method: "POST",
        });
      } catch (error) {
        console.error("Error ticking room:", error);
      }
    }, 2000);

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, [room, roomCode, gameState]);

  // Handle answer submission
  const handleAnswer = async (answerIndex: number) => {
    if (!room || !myPlayerId || selectedAnswer !== null) return;

    setSelectedAnswer(answerIndex);

    try {
      await fetch(`/api/rooms/${roomCode}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          player_id: myPlayerId,
          round_number: room.round_number,
          answer_index: answerIndex,
        }),
      });

      // Always show reveal phase after answering so player can see the result
      // This ensures they always see whether they got it right or wrong
      if (gameStateRef.current === "question") {
        // Show reveal phase after a brief delay to let answer submit
        setTimeout(() => {
          if (gameStateRef.current === "question") {
            setGameState("reveal");
            
            // Set timeout for reveal phase duration (7000ms)
            if (revealTimeoutRef.current) {
              clearTimeout(revealTimeoutRef.current);
            }
            revealTimeoutRef.current = setTimeout(() => {
              // Server will handle transition to leaderboard via tick
            }, 7000);
          }
        }, 300); // Small delay to let answer submit complete
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      setSelectedAnswer(null);
    }
  };

  // Handle skip/feedback
  const handleSkip = async (feedbackType: "skip" | "inappropriate" | "confusing") => {
    if (!room || !myPlayerId) return;

    try {
      await fetch(`/api/rooms/${roomCode}/skip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          player_id: myPlayerId,
          feedback_type: feedbackType,
        }),
      });
    } catch (error) {
      console.error("Error skipping question:", error);
    }
  };

  // Capture previous scores when transitioning to leaderboard
  const previousScoresRef = useRef<Map<string, number>>(new Map());
  
  useEffect(() => {
    if (gameState === "leaderboard" && players.length > 0) {
      // If we don't have previous scores yet, capture current scores as baseline
      // (this handles the first leaderboard display)
      if (previousScores.size === 0) {
        const currentScores = new Map<string, number>();
        players.forEach((p) => {
          currentScores.set(p.team_name, p.score);
        });
        setPreviousScores(currentScores);
        previousScoresRef.current = currentScores;
      }
    }
  }, [gameState, players, previousScores.size]);

  // Determine round winner (highest score after round ends)
  useEffect(() => {
    if (gameState === "leaderboard" && players.length > 0) {
      const sorted = [...players].sort((a, b) => b.score - a.score);
      if (sorted.length > 0 && sorted[0].score > 0) {
        setRoundWinner(sorted[0].team_name);
      }
    }
  }, [gameState, players]);

  if (gameState === "loading" || !room || !currentQuestion) {
    return (
      <main className="h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Persistent Header */}
      <header className="shadow-sm px-4 py-3 flex items-center justify-between relative" style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
        {/* Team Name - Centered */}
        {myTeamName && (
          <div className="flex items-center space-x-2 absolute left-1/2 transform -translate-x-1/2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: myTeamColor }}
            />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {myTeamName}
            </span>
          </div>
        )}

        {/* Right side - More Menu */}
        <div className="flex items-center ml-auto">
          <MoreMenu
            onInvite={() => setInviteSheetOpen(true)}
            onQuit={() => router.push("/")}
          />
        </div>
      </header>

      {/* Game Content */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        {gameState === "question" || gameState === "reveal" ? (
          <QuestionView
            question={currentQuestion.question}
            answers={currentQuestion.choices}
            onAnswer={handleAnswer}
            selectedAnswer={selectedAnswer}
            teamColor={myTeamColor}
            teamName={myTeamName}
            roundEndsAt={gameState === "reveal" ? currentRoundEndsAtRef.current : room.round_ends_at}
            correctAnswerIndex={correctAnswerIndex}
            isRevealPhase={gameState === "reveal"}
            explanation={currentQuestion.explanation}
          />
        ) : (
          <LeaderboardView
            teams={players.map((p) => ({
              name: p.team_name,
              score: p.score,
              color: p.team_color,
            }))}
            roundWinner={roundWinner}
            previousScores={previousScores}
          />
        )}
      </div>

      {/* Feedback Link - Pinned to Bottom */}
      {(gameState === "question" || gameState === "reveal") && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center z-10">
          <button
            onClick={() => setQuestionControlsOpen(true)}
            className="underline-offset-2 bg-surface/8 px-4 py-2 rounded-full"
            style={{ color: "rgba(255, 255, 255, 0.2)", fontSize: "12px" }}
          >
            Something looks off
          </button>
        </div>
      )}

      {/* Bottom Sheets */}
      <InviteSheet
        roomCode={roomCode}
        isOpen={inviteSheetOpen}
        onClose={() => setInviteSheetOpen(false)}
        isHost={true}
      />

      <QuestionControlsSheet
        isOpen={questionControlsOpen}
        onClose={() => setQuestionControlsOpen(false)}
        onSkip={() => handleSkip("skip")}
        onNotAppropriate={() => handleSkip("inappropriate")}
        onBadConfusing={() => handleSkip("confusing")}
      />
    </main>
  );
}
