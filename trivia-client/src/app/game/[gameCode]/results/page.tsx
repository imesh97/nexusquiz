"use client";

import { getLeaderUrl } from "@/utils/network";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";

export default function ResultsPage() {
  const router = useRouter();
  const gameCode = useGameStore((state) => state.gameCode); // Assume you store the game code in your global state
  const players = useGameStore((state) => state.players);
  const isHost = useGameStore((state) => state.isHost);
  const resetGame = useGameStore((state) => state.resetGame);

  // Sort players in descending order by score
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // Set up a WebSocket to listen for "game_closed" events
  useEffect(() => {
    const connectToWebSocket = async () => {
      try {
        const leaderUrl = await getLeaderUrl();
        const ws = new WebSocket(leaderUrl.replace(/^http/, "ws") + `/ws/${gameCode}`);
  
        ws.onopen = () => {
          console.log("✅ WebSocket connected on results page");
        };
  
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === "game_closed") {
              resetGame();
              router.push("/");
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };
  
        ws.onerror = (err) => {
          if (JSON.stringify(err) === "{}") return;
          console.error("❌ WebSocket error:", err);
        };
  
        ws.onclose = () => {
          console.log("🔌 WebSocket connection closed on results page");
        };
      } catch (error) {
        console.error("❌ Failed to establish WebSocket on results page:", error);
      }
    };
  
    connectToWebSocket();
  }, [gameCode, resetGame, router]);
  

  // Handler for the host's "Play Again" (or end game) button
  const handleEndGame = async () => {
    try {
      const leaderUrl = await getLeaderUrl();
      const response = await fetch(`${leaderUrl}/lobby/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: gameCode,
          player_id: useGameStore.getState().playerId,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to end game");
      }
      // After successful end, reset the game state and navigate home.
      resetGame();
      router.push("/");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error ending game:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-8">
      <h1 className="text-5xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
        🏆 Leaderboard
      </h1>
      <div className="w-full max-w-md bg-gray-800 bg-opacity-70 rounded-xl shadow-2xl p-6">
        <ul className="space-y-4">
          {sortedPlayers.map((player, index) => (
            <li key={player.id} className="flex justify-between items-center">
              <span className="text-xl font-medium">
                {index + 1}. {player.name}
              </span>
              <span className="text-xl font-bold">{player.score}</span>
            </li>
          ))}
        </ul>
      </div>
      {isHost && (
        <button
          onClick={handleEndGame}
          className="mt-8 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out focus:outline-none"
        >
          Play Again
        </button>
      )}
    </div>
  );
}
