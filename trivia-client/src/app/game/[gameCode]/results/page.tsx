"use client";
import { getLeaderUrl } from "@/utils/network";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { motion } from "framer-motion";

export default function ResultsPage() {
  const router = useRouter();
  const gameCode = useGameStore((state) => state.gameCode);
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
        const ws = new WebSocket(
          leaderUrl.replace(/^http/, "ws") + `/ws/${gameCode}`
        );

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
        console.error(
          "❌ Failed to establish WebSocket on results page:",
          error
        );
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-black via-purple-900 to-black text-white px-4 py-10 font-mono">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-3xl bg-[#151525]/80 backdrop-blur-xl rounded-3xl border border-purple-600 p-8 md:p-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-fuchsia-500 via-purple-400 to-pink-500 text-transparent bg-clip-text animate-fade-in">
            🏆 Final Results
          </h1>
          <div className="w-32 h-1 mt-4 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 mx-auto rounded-full animate-pulse" />
        </div>

        <div className="bg-gray-900/60 border border-purple-700 rounded-2xl p-6 shadow-lg max-w-xl mx-auto">
          <ul className="space-y-3">
            {sortedPlayers.map((player, index) => {
              // Special styling for top 3 players
              let rankColor = "text-purple-400";
              let bgColor = "bg-gray-800";
              let medal = "";

              if (index === 0) {
                rankColor = "text-yellow-400";
                bgColor = "bg-gray-800/90 border-yellow-500";
                medal = "🥇 ";
              } else if (index === 1) {
                rankColor = "text-gray-300";
                bgColor = "bg-gray-800/80";
                medal = "🥈 ";
              } else if (index === 2) {
                rankColor = "text-amber-600";
                bgColor = "bg-gray-800/70";
                medal = "🥉 ";
              }

              return (
                <motion.li
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className={`flex justify-between items-center ${bgColor} px-4 py-3 rounded-xl text-white font-mono shadow-sm border border-purple-700/50`}
                >
                  <div className="flex items-center">
                    <span className={`${rankColor} font-bold text-xl mr-3`}>
                      #{index + 1}
                    </span>
                    <span className="text-lg">
                      {medal}
                      {player.name}
                    </span>
                  </div>
                  <span className="text-lime-400 font-bold text-xl">
                    {player.score} pts
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </div>

        {isHost && (
          <div className="text-center mt-10">
            <motion.button
              onClick={handleEndGame}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white px-8 py-4 rounded-xl font-semibold border border-purple-300 shadow-lg text-xl"
            >
              Play Again
            </motion.button>
          </div>
        )}
      </motion.div>

      <footer className="mt-8 text-center text-gray-400 text-sm">
        Powered by Next.js & FastAPI | © {new Date().getFullYear()} NexusQuiz
      </footer>
    </div>
  );
}
