"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getOrCreateDeviceId, getTeamColorHex, getTextColorForBackground } from "@/lib/utils";
import CircularTimer from "@/app/components/CircularTimer";
import ResultIndicator from "@/app/components/ResultIndicator";
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
  const roomRef = useRef<Room | null>(null);
  const gameStateRef = useRef<GameState>(gameState);
  const scoresBeforeScoringRef = useRef<Map<string, number>>(new Map());
  const nextQuestionIdRef = useRef<string | null>(null);
  const currentRoundEndsAtRef = useRef<string | null>(null);
  const preservedQuestionRef = useRef<Question | null>(null);
  const preservedSelectedAnswerRef = useRef<number | null>(null);
  const preservedCorrectAnswerIndexRef = useRef<number | null>(null);
  const deviceId = getOrCreateDeviceId();
  const [shouldFadeAnswers, setShouldFadeAnswers] = useState(false);
  const [leaderboardOpacity, setLeaderboardOpacity] = useState(0);
  const [nextRoundEndsAt, setNextRoundEndsAt] = useState<string | null>(null);

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

      // Always go to question state (leaderboard shown during reveal phase)
      setGameState("question");
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
    setShouldFadeAnswers(false);
    setLeaderboardOpacity(0);
    setNextRoundEndsAt(null);
    
    // Clear current question and set to loading state for clean transition
    setCurrentQuestion(null);
    setGameState("loading");
    
    // Load question data FIRST, then set state to prevent rendering with stale data
    const latestRoom = roomRef.current;
    const questionIdToLoad = latestRoom?.current_question_id || questionId;
    
    if (questionIdToLoad) {
      await loadQuestion(questionIdToLoad);
      
      // Store the current round's end time for use during reveal phase
      if (latestRoom) {
        currentRoundEndsAtRef.current = latestRoom.round_ends_at;
      }
      
      // Clear previous scores for next round
      setPreviousScores(new Map());
      
      // Set game state to question AFTER loading, so we render with the new question data
      setGameState("question");
    }
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
            
            // Store next round's end time for timer display
            if (updatedRoom.round_ends_at) {
              setNextRoundEndsAt(updatedRoom.round_ends_at);
            }

            // Sequential flow: question -> reveal -> leaderboard -> next round
            // When round advances, we should show leaderboard for the round that just ended
            // Don't set up timeouts to load next question here - wait until we're actually in leaderboard
            if (gameStateRef.current === "reveal") {
              // Don't update question data, selectedAnswer, or correctAnswerIndex during reveal phase
              // Preserve them so user can finish reading the explanation
              // Just update the room state (for other data like scores)
              setRoom(updatedRoom);
              setNextRoundEndsAt(updatedRoom.round_ends_at);
              // Start fading in leaderboard if not already started
              if (leaderboardOpacity < 1) {
                setTimeout(() => {
                  setLeaderboardOpacity(1);
                }, 0);
              }
              // Already in reveal phase - reset timeout to give full 7000ms for reading explanation
              if (revealTimeoutRef.current) {
                clearTimeout(revealTimeoutRef.current);
              }
              revealTimeoutRef.current = setTimeout(async () => {
                // Transition directly to next question (leaderboard already shown during reveal)
                const questionId = nextQuestionIdRef.current;
                if (questionId) {
                  await transitionToQuestion(questionId);
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
              setShouldFadeAnswers(false);
              setLeaderboardOpacity(0);
              setNextRoundEndsAt(updatedRoom.round_ends_at);
              
              // Start fading answers after 3 seconds
              setTimeout(() => {
                setShouldFadeAnswers(true);
              }, 3000);
              
              // Start fading in leaderboard after 3 seconds
              setTimeout(() => {
                setLeaderboardOpacity(1);
              }, 3000);
              
              if (revealTimeoutRef.current) {
                clearTimeout(revealTimeoutRef.current);
              }
              revealTimeoutRef.current = setTimeout(async () => {
                // Transition directly to next question (leaderboard already shown during reveal)
                const questionId = nextQuestionIdRef.current;
                if (questionId) {
                  await transitionToQuestion(questionId);
                }
              }, 7000);
              // Don't clear selectedAnswer or correctAnswerIndex yet - keep them for reveal phase
              setRoom(updatedRoom);
            }
          } else if (updatedRoom.current_question_id && updatedRoom.current_question_id !== currentRoom.current_question_id) {
            // Question changed (skip) - go directly to question
            {
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
            }
          } else {
            // Just update room state (score changes, etc.)
            setRoom(updatedRoom);
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
        setShouldFadeAnswers(false);
        setLeaderboardOpacity(0);
        
        // Estimate next round end time if not yet available (33 seconds from now)
        if (!nextRoundEndsAt) {
          const estimatedNextRoundEndsAt = new Date(Date.now() + 33 * 1000).toISOString();
          setNextRoundEndsAt(estimatedNextRoundEndsAt);
        }
        
        // Start fading answers after 3 seconds
        setTimeout(() => {
          setShouldFadeAnswers(true);
        }, 3000);
        
        // Start fading in leaderboard after 3 seconds (same time as answer fade)
        setTimeout(() => {
          setLeaderboardOpacity(1);
        }, 3000);
        
        // After 7000ms, transition directly to next question (leaderboard already shown during reveal)
        if (revealTimeoutRef.current) {
          clearTimeout(revealTimeoutRef.current);
        }
        revealTimeoutRef.current = setTimeout(async () => {
          // Transition directly to next question after reveal duration
          if (gameStateRef.current === "reveal") {
            const questionId = nextQuestionIdRef.current || roomRef.current?.current_question_id;
            if (questionId) {
              await transitionToQuestion(questionId);
            }
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
            setShouldFadeAnswers(false);
            setLeaderboardOpacity(0);
            
            // Estimate next round end time if not yet available (33 seconds from now)
            if (!nextRoundEndsAt && room) {
              const estimatedNextRoundEndsAt = new Date(Date.now() + 33 * 1000).toISOString();
              setNextRoundEndsAt(estimatedNextRoundEndsAt);
            }
            
            // Start fading answers after 3 seconds
            setTimeout(() => {
              setShouldFadeAnswers(true);
            }, 3000);
            
            // Start fading in leaderboard after 3 seconds
            setTimeout(() => {
              setLeaderboardOpacity(1);
            }, 3000);
            
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

  // Capture previous scores when transitioning to reveal (for leaderboard display)
  const previousScoresRef = useRef<Map<string, number>>(new Map());
  
  useEffect(() => {
    if (gameState === "reveal" && players.length > 0) {
      // If we don't have previous scores yet, capture current scores as baseline
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
    if (gameState === "reveal" && players.length > 0) {
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
      <div className="flex-1 flex items-center justify-center min-h-0 relative">
        {gameState === "question" || gameState === "reveal" ? (
          <div className="flex flex-col items-center justify-center space-y-3 px-4 py-2 w-full max-h-full overflow-hidden">
            {/* Explanation/Question section - stays visible throughout */}
            <div className="flex flex-col items-center space-y-3 flex-shrink-0 w-full">
              {/* Show result indicator if player answered during reveal, otherwise timer/explanation */}
              {gameState === "reveal" && selectedAnswer !== null ? (
                <ResultIndicator isCorrect={selectedAnswer === correctAnswerIndex} size={60} />
              ) : gameState === "reveal" && currentQuestion.explanation ? (
                <div className="w-full max-w-2xl px-2">
                  <div className="px-4 py-3 bg-surface-secondary/50 rounded-xl border border-text-secondary/20 w-full">
                    <p className="text-sm sm:text-base text-text-primary text-center leading-relaxed">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                </div>
              ) : (
                <CircularTimer endTime={gameState === "reveal" ? currentRoundEndsAtRef.current : room.round_ends_at} duration={20} size={60} />
              )}
              
              {/* Show explanation below result indicator if player answered */}
              {gameState === "reveal" && selectedAnswer !== null && currentQuestion.explanation && (
                <div className="w-full max-w-2xl px-2">
                  <div className="px-4 py-3 bg-surface-secondary/50 rounded-xl border border-text-secondary/20 w-full">
                    <p className="text-sm sm:text-base text-text-primary text-center leading-relaxed">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Question Text - hide when explanation is shown or when showing result */}
              {!(gameState === "reveal" && (currentQuestion.explanation || selectedAnswer !== null)) && (
                <h2 className="text-lg sm:text-xl font-bold text-center text-text-primary px-2 leading-tight max-w-2xl">
                  {currentQuestion.question}
                </h2>
              )}
            </div>

            {/* Answers area - where leaderboard will fade in */}
            <div className="w-full max-w-md relative min-h-[200px]">
              {/* Question View Answers - fade out */}
              <div 
                className="w-full space-y-2 transition-opacity duration-1000"
                style={{ opacity: shouldFadeAnswers ? 0 : 1 }}
              >
                {currentQuestion.choices.map((answer, index) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrectAnswer = correctAnswerIndex !== null && index === correctAnswerIndex;
                  const isWrongSelected = gameState === "reveal" && isSelected && !isCorrectAnswer;

                  let buttonStyle: React.CSSProperties = {};
                  let buttonClasses = "w-full py-3 px-4 rounded-2xl text-base font-semibold text-center transition-all min-h-[56px] flex items-center justify-center ";

                  if (gameState === "reveal") {
                    if (isCorrectAnswer && isSelected) {
                      buttonStyle = {
                        backgroundColor: "#22C55E",
                        color: "#FFFFFF",
                        border: "3px solid #16A34A",
                        transform: "scale(1.05)",
                      };
                      buttonClasses += "shadow-lg";
                    } else if (isCorrectAnswer) {
                      buttonStyle = { backgroundColor: "#22C55E", color: "#FFFFFF" };
                      buttonClasses += "shadow-lg";
                    } else if (isWrongSelected) {
                      // Wrong selected answer: red background, white text
                      buttonStyle = {
                        backgroundColor: "#E63946",
                        color: "#FFFFFF",
                        border: "3px solid #DC2626",
                        opacity: 0.9,
                      };
                      buttonClasses += "shadow-md";
                    } else {
                      buttonStyle = { 
                        opacity: 0.4,
                        backgroundColor: "#FFFFFF",
                        color: "#1F2937",
                      };
                      buttonClasses += "shadow-md border-2 border-transparent";
                    }
                    buttonClasses += " cursor-default";
                  } else {
                    if (isSelected) {
                      // Selected answer during question phase: use brand orange
                      buttonStyle = { 
                        backgroundColor: "#FCB107", 
                        color: "#FFFFFF",
                      };
                      buttonClasses += "shadow-lg";
                    } else {
                      buttonClasses += "bg-surface text-text-primary-dark shadow-md border-2 border-transparent";
                    }
                    if (selectedAnswer === null) {
                      buttonClasses += " active:scale-[0.98]";
                    } else {
                      buttonClasses += " cursor-default";
                    }
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => gameState === "question" && selectedAnswer === null && handleAnswer(index)}
                      disabled={selectedAnswer !== null || gameState === "reveal"}
                      className={buttonClasses}
                      style={buttonStyle}
                    >
                      {answer}
                    </button>
                  );
                })}
              </div>

              {/* Leaderboard - fades in where answers were */}
              {gameState === "reveal" && (
                <div
                  className="absolute inset-0 flex items-start justify-center transition-opacity duration-1000"
                  style={{ opacity: leaderboardOpacity, pointerEvents: leaderboardOpacity > 0.5 ? 'auto' : 'none' }}
                >
                  <div className="w-full max-w-md">
                    {/* Use compact leaderboard render here - just the teams list */}
                    <LeaderboardView
                      teams={players.map((p) => ({
                        name: p.team_name,
                        score: p.score,
                        color: p.team_color,
                      }))}
                      roundWinner={roundWinner}
                      previousScores={previousScores}
                      explanation={undefined} // Explanation is shown above
                      nextRoundEndsAt={nextRoundEndsAt}
                      showTimer={false} // No timer during reveal, explanation replaces it
                      compact={true} // Compact mode for absolute positioning
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
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
