// src/app/game/[gameCode]/play/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
}

const TIMER_DURATION = 10; // seconds

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

  // Validate that necessary info is present
  useEffect(() => {
    if (!playerName || !gameCode) {
      console.warn("Missing player or game info");
    }
  }, [playerName, gameCode]);

  useEffect(() => {
    async function fetchLobbyState() {
      try {
        const response = await fetch(
          `http://localhost:8000/lobby/state/${gameCode}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch lobby state");
        }
        const data = await response.json();
        if (data.status === "playing" && data.question && data.question.id) {
          setCurrentQuestion(data.question);
          setSelectedOption(null);
          setAnswered(false);
          setTimeLeft(TIMER_DURATION);
          setShowResults(false);
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
      return;
    }
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  // WebSocket connection for game events
  useEffect(() => {
    const connectToLeaderWebSocket = async () => {
      try {
        const res = await fetch("http://localhost:8000/raft/leader");
        const data = await res.json();
  
        if (!data.leader_url) {
          throw new Error("Missing leader_url from backend");
        }
  
        const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
        const leaderHost = data.leader_url.replace(/^http/, wsProtocol);
        const ws = new WebSocket(`${leaderHost}/ws/${gameCode}`);
  
        ws.onopen = () => {
          console.log("✅ WebSocket connected on play page");
        };
  
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === "score_update") {
              setPlayers(data.players);
            }
            if (data.event === "game_started") {
              setCurrentQuestion(data.question);
              setSelectedOption(null);
              setAnswered(false);
              setTimeLeft(TIMER_DURATION);
              setShowResults(false);
            }
            if (data.event === "next_question") {
              if (data.question && data.question.id) {
                setCurrentQuestion(data.question);
                setSelectedOption(null);
                setAnswered(false);
                setTimeLeft(TIMER_DURATION);
                setShowResults(false);
              } else {
                router.push(`/game/${gameCode}/results`);
              }
            }
            if (data.event === "game_over") {
              router.push(`/game/${gameCode}/results`);
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };
  
        ws.onerror = (event) => {
          console.error("❌ WebSocket connection error on play page:", event);
        };
  
        ws.onclose = () => {
          console.log("🔌 WebSocket connection closed on play page");
        };
      } catch (e) {
        console.error("❌ Failed to connect to WebSocket on play page:", e);
      }
    };
  
    connectToLeaderWebSocket();
  }, [gameCode, router, setPlayers]);
  

  // Function to submit an answer
  const handleAnswer = async (index: number) => {
    if (!answered && !showResults) {
      setSelectedOption(index);
      setAnswered(true);

      try {
        const response = await fetch("http://localhost:8000/lobby/answer", {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error("Error submitting answer:", error);
      }
    }
  };

  // Host-only function to trigger the next question
  const handleNextQuestion = async () => {
    try {
      const response = await fetch("http://localhost:8000/lobby/next", {
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
      // The new question will also be broadcast via WebSocket, so no need to set state here.
      // However, if the response indicates no more questions, navigate to results.
      if (!data.question || !data.question.id) {
        router.push(`/game/${gameCode}/results`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error moving to next question:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-8">
      <div className="w-full max-w-xl bg-gray-800 bg-opacity-70 backdrop-filter backdrop-blur-lg rounded-xl shadow-2xl p-8 border border-purple-700/50 text-center">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
            NexusQuiz - Round {currentQuestion.id || ""}
          </h1>
          <div className="text-sm bg-black text-green-400 px-3 py-1 rounded-md shadow-inner animate-pulse font-mono">
            ⏳ {timeLeft}s
          </div>
        </div>

        <p className="text-xl font-semibold mb-4 text-purple-300">
          {currentQuestion.text}
        </p>

        <div className="grid grid-cols-1 gap-4 mb-6">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedOption === index;
            const isCorrect = currentQuestion.correctIndex === index;
            const isAnswerReveal = showResults;

            const baseClass =
              "px-6 py-4 rounded-lg text-lg font-medium transition-all duration-300";

            let colorClass = "bg-gray-700";

            if (isAnswerReveal) {
              colorClass = isCorrect
                ? "bg-green-600"
                : isSelected
                ? "bg-red-600"
                : "bg-gray-700 opacity-50";
            } else if (!answered) {
              colorClass = "hover:bg-purple-600";
            } else if (isSelected) {
              colorClass = "bg-gray-600";
            }

            return (
              <button
                key={index}
                disabled={answered || isAnswerReveal}
                onClick={() => handleAnswer(index)}
                className={`${baseClass} ${colorClass}`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {!showResults && answered && (
          <p className="text-green-400 font-semibold animate-pulse">
            Answer locked in! 🎉
          </p>
        )}

        {showResults && (
          <div className="mt-6 text-center">
            <p className="text-lg font-bold text-green-400 mb-2">
              ✅ Correct Answer:{" "}
              {currentQuestion.options[currentQuestion.correctIndex]}
            </p>
            <div className="text-sm text-purple-300 italic">
              <p className="mb-1">Players answered:</p>
              <ul className="list-disc list-inside space-y-1">
                {players.map((player) => (
                  <li key={player.id} className="text-white">
                    {player.name}{" "}
                    {player.name === playerName && (
                      <span className="text-green-400">(You)</span>
                    )}{" "}
                    — <span className="italic text-gray-400">answered</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {isHost && showResults && (
          <button
            onClick={handleNextQuestion}
            className="mt-4 w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-400"
          >
            Next Question
          </button>
        )}
      </div>

      <footer className="mt-8 text-center text-gray-500 text-sm">
        Powered by Next.js & FastAPI | © {new Date().getFullYear()} NexusQuiz
      </footer>
    </div>
  );
}
