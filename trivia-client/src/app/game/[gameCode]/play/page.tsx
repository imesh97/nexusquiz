/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/game/[gameCode]/play/page.tsx
"use client";
import { getLeaderUrl } from "@/utils/network";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { AnimatePresence, motion } from "framer-motion";

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
}

const TIMER_DURATION = 5; // seconds

export default function PlayPage() {
  const router = useRouter();
  const { gameCode } = useParams();
  const playerName = useGameStore((state) => state.playerName);
  const playerId = useGameStore((state) => state.playerId);
  const players = useGameStore((state) => state.players);
  const setPlayers = useGameStore((state) => state.setPlayers);
  const isHost = useGameStore((state) => state.isHost);

  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    id: 0,
    text: "Loading question...",
    options: [],
    correctIndex: -1,
  });

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [showResults, setShowResults] = useState(false);
  const [voteCounts, setVoteCounts] = useState<number[]>([0, 0, 0, 0]);

  // Validate that necessary info is present
  useEffect(() => {
    if (!playerName || !gameCode) {
      console.warn("Missing player or game info");
    }
  }, [playerName, gameCode]);

  useEffect(() => {
    async function fetchLobbyState() {
      try {
        const leaderUrl = await getLeaderUrl(); // ✅ dynamic leader
        const response = await fetch(`${leaderUrl}/lobby/state/${gameCode}`);
        if (!response.ok) throw new Error("Failed to fetch lobby state");

        const data = await response.json();
        if (data.status === "playing" && data.question && data.question.id) {
          setCurrentQuestion(data.question);
          setSelectedOption(null);
          setAnswered(false);
          setTimeLeft(TIMER_DURATION);
          setShowResults(false);
          // Reset vote counts for the new question
          setVoteCounts(new Array(data.question.options.length).fill(0));
        }
      } catch (error) {
        console.error("Error fetching lobby state:", error);
      }
    }

    fetchLobbyState();
  }, [gameCode]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      setShowResults(true);

      // If the user hasn't answered when timer expires, record it as unanswered
      if (!answered) {
        // Mark as answered but with no selection to indicate timeout
        setAnswered(true);
        setSelectedOption(null);

        // Submit a "no answer" to the backend
        const submitNoAnswer = async () => {
          try {
            const leaderUrl = await getLeaderUrl();
            await fetch(`${leaderUrl}/lobby/answer`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code: gameCode,
                player_id: playerId,
                answer: -1, // -1 indicates no answer was selected
              }),
            });
          } catch (error) {
            console.error("Error submitting no answer:", error);
          }
        };

        submitNoAnswer();
      }
      return;
    }
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, answered, gameCode, playerId]);

  // WebSocket connection for game events
  useEffect(() => {
    const connectToLeaderWebSocket = async () => {
      try {
        const leaderUrl = await getLeaderUrl();
        const ws = new WebSocket(
          leaderUrl.replace("http", "ws") + `/ws/${gameCode}`
        );

        ws.onopen = () => console.log("✅ WebSocket connected on play page");

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.event === "score_update") {
            console.log("Received player data:", data.players);
            setPlayers(data.players as any[]); // Simple type assertion

            // Update vote counts if this includes answer stats
            if (data.voteCounts) {
              setVoteCounts(data.voteCounts);
            }
          }

          if (data.event === "game_started") {
            setCurrentQuestion(data.question);
            setSelectedOption(null);
            setAnswered(false);
            setTimeLeft(TIMER_DURATION);
            setShowResults(false);
            setVoteCounts(new Array(data.question.options.length).fill(0));
          }
          if (data.event === "next_question") {
            if (data.question?.id) {
              setCurrentQuestion(data.question);
              setSelectedOption(null);
              setAnswered(false);
              setTimeLeft(TIMER_DURATION);
              setShowResults(false);
              setVoteCounts(new Array(data.question.options.length).fill(0));
            } else {
              router.push(`/game/${gameCode}/results`);
            }
          }
          if (data.event === "game_over") {
            router.push(`/game/${gameCode}/results`);
          }
          // Handle timeout event if all players haven't answered when timer expires
          if (data.event === "question_timeout") {
            setShowResults(true);
            if (!answered) {
              setAnswered(true);
              setSelectedOption(null);
            }
          }
          // Handle player answer updates
          if (data.event === "player_answer") {
            setVoteCounts((prev) => {
              const updated = [...prev];
              if (data.answerIndex >= 0 && data.answerIndex < updated.length) {
                updated[data.answerIndex]++;
              }
              return updated;
            });
          }
        };

        ws.onerror = (event) => console.error("❌ WebSocket error:", event);
        ws.onclose = () => console.log("🔌 WebSocket closed on play page");
      } catch (e) {
        console.error("❌ Failed to connect to WebSocket:", e);
      }
    };

    connectToLeaderWebSocket();
  }, [gameCode, router, setPlayers, answered]);

  // Function to submit an answer
  const handleAnswer = async (index: number) => {
    if (!answered && !showResults) {
      setSelectedOption(index);
      setAnswered(true);

      // Update local vote counts
      setVoteCounts((prev) => {
        const updated = [...prev];
        updated[index]++;
        return updated;
      });

      try {
        const leaderUrl = await getLeaderUrl();
        const response = await fetch(`${leaderUrl}/lobby/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: gameCode,
            player_id: playerId,
            answer: index,
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to submit answer");
        }
        const result = await response.json();
        console.log("Answer submission result:", result);
      } catch (error: any) {
        console.error("Error submitting answer:", error);
      }
    }
  };

  // Host-only function to trigger the next question
  const handleNextQuestion = async () => {
    try {
      const leaderUrl = await getLeaderUrl();
      const response = await fetch(`${leaderUrl}/lobby/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: gameCode, player_id: playerId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        // If no more questions, navigate to results.
        if (errorData.detail === "No more questions") {
          router.push(`/game/${gameCode}/results`);
          return;
        }
        throw new Error(errorData.detail || "Failed to move to next question");
      }
      const data = await response.json();
      console.log("Next question response:", data);

      if (!data.question || !data.question.id) {
        router.push(`/game/${gameCode}/results`);
      }
    } catch (error: any) {
      console.error("Error moving to next question:", error);
    }
  };

  const Leaderboard = () => {
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

    return (
      <div className="mt-10 text-center font-mono">
        <h3 className="text-2xl font-extrabold text-pink-400 mb-4">
          🏆 <span className="tracking-wider">Leaderboard</span>
        </h3>
        <div className="bg-gray-900/60 border border-purple-700 rounded-2xl p-6 shadow-lg max-w-md mx-auto">
          <ul className="space-y-3">
            {sorted.map((p, idx) => (
              <li
                key={p.id}
                className="flex justify-between items-center bg-gray-800 px-4 py-2 rounded-xl text-white font-mono text-sm shadow-sm"
              >
                <span className="text-purple-400">#{idx + 1}</span>
                <span>
                  {p.name}{" "}
                  {p.name === playerName && (
                    <span className="text-lime-400">(You)</span>
                  )}
                </span>
                <span className="text-lime-400 font-bold">
                  {p.score || 0} pts
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-black via-purple-900 to-black text-white px-4 py-10 font-mono">
      <div className="w-full max-w-3xl bg-[#151525]/80 backdrop-blur-xl rounded-3xl border border-purple-600">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5 }}
            className="p-8 md:p-10"
          >
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-fuchsia-500 via-purple-400 to-pink-500 text-transparent bg-clip-text animate-fade-in">
                NexusQuiz
                {currentQuestion.id > 0 && (
                  <span className="text-2xl">
                    {" "}
                    - Round {currentQuestion.id}
                  </span>
                )}
              </h1>
              <div className="flex items-center gap-2 text-sm bg-black/80 text-lime-400 px-4 py-2 rounded-full shadow-inner font-mono animate-pulse border border-lime-500">
                <span className="font-bold text-xs">TIME</span>
                <span className="text-base font-bold">{timeLeft}s</span>
              </div>
            </div>

            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-400 to-fuchsia-500 shadow-lg drop-shadow-xl animate-fade-in-slow">
                {currentQuestion.text}
              </h2>
              <div className="w-24 h-1 mt-3 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 mx-auto rounded-full animate-pulse" />
            </div>

            <div className="grid grid-cols-1 gap-5">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedOption === index;
                const isCorrect = currentQuestion.correctIndex === index;
                const isAnswerReveal = showResults;
                let colorClass = "bg-gray-800 border-gray-700";

                if (isAnswerReveal) {
                  colorClass = isCorrect
                    ? "bg-green-600 border-green-400 text-white"
                    : isSelected
                    ? "bg-red-600 border-red-400 text-white"
                    : "bg-gray-800 border-gray-600 opacity-50 text-gray-300";
                } else if (!answered) {
                  colorClass =
                    "hover:bg-purple-600 hover:border-purple-500 text-white";
                } else if (isSelected) {
                  colorClass = "bg-gray-700 border-purple-500 text-white";
                }

                return (
                  <button
                    key={index}
                    disabled={answered || isAnswerReveal}
                    onClick={() => handleAnswer(index)}
                    className={`w-full px-6 py-4 rounded-xl text-lg font-semibold border ${colorClass}`}
                  >
                    {String.fromCharCode(65 + index)}. {option}
                  </button>
                );
              })}
            </div>

            {showResults && (
              <>
                <div className="mt-10 text-center">
                  <p className="text-green-400 text-xl font-bold mb-6">
                    ✔ Correct Answer:{" "}
                    {currentQuestion.options[currentQuestion.correctIndex]}
                  </p>
                  <Leaderboard />
                  {isHost && (
                    <button
                      onClick={handleNextQuestion}
                      className="mt-6 bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white px-6 py-3 rounded-lg font-semibold border border-purple-300 hover:scale-105 transition"
                    >
                      Next Question →
                    </button>
                  )}
                </div>
              </>
            )}

            {!showResults && answered && (
              <div className="mt-6 text-center">
                <p className="text-lime-400 text-lg font-bold">
                  Locked In. Awaiting Results...
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="mt-8 text-center text-gray-400 text-sm">
        Powered by Next.js & FastAPI | © {new Date().getFullYear()} NexusQuiz
      </footer>
    </div>
  );
}
