// src/app/game/[gameCode]/page.tsx
"use client";

import { getLeaderUrl, clearLeaderCache } from "@/utils/network";
import { useGameWebSocket } from "@/hooks/useGameWebSocket";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const gameCodeParam = params?.gameCode as string;
  const [leaderUrl, setLeaderUrl] = useState<string | null>(null);

  const playerName = useGameStore((state) => state.playerName);
  const playerId = useGameStore((state) => state.playerId);
  const players = useGameStore((state) => state.players);
  const setPlayers = useGameStore((state) => state.setPlayers);
  const isHost = useGameStore((state) => state.isHost);
  const resetGame = useGameStore((state) => state.resetGame);

  const [error, setError] = useState<string | null>(null);

  // Check if we have the necessary data
  useEffect(() => {
    if (!playerName || !gameCodeParam) {
      console.warn("Redirecting: Missing player or game info.");
      resetGame();
      router.push("/");
    }
  }, [playerName, gameCodeParam, resetGame, router]);

  // Get the leader URL for API calls
  useEffect(() => {
    const fetchLeaderUrl = async () => {
      try {
        console.log("Fetching leader URL for API calls...");
        const url = await getLeaderUrl();
        console.log(`Leader URL resolved: ${url}`);
        setLeaderUrl(url);
      } catch (err) {
        console.warn("⚠️ Leader URL resolution issue:", err);
        setError("Could not connect to game server. Please try again.");
      }
    };

    fetchLeaderUrl();
  }, []);

  // Use our custom WebSocket hook
  const { isConnected, connectionAttempts, error: wsError, reconnect } = useGameWebSocket({
    gameCode: gameCodeParam,
    autoReconnect: true,
    maxReconnectAttempts: 5,
    onMessage: (data) => {
      if (data.event === "game_started") {
        console.log("Game started, redirecting to play page");
        router.push(`/game/${gameCodeParam}/play`);
      }
      if (data.event === "player_joined") {
        console.log("Player joined, updating player list", data.players);
        setPlayers(data.players);
      }
    },
    onError: (err) => {
      // Only show errors if we've exceeded a certain threshold
      if (connectionAttempts > 2) {
        console.warn("⚠️ Connection issues, reconnecting...");
        setError("Connection error. We're trying to reconnect...");
      }
    },
    onOpen: () => {
      console.log("WebSocket connected in lobby");
      setError(null); // Clear any previous errors
    },
    onClose: () => {
      // Don't show any message on close as we'll auto-reconnect
    },
  });

  // Function for the host to start the game
  const handleStartGame = async () => {
    try {
      if (!leaderUrl) {
        setError("Waiting for server connection. Please try again in a moment.");
        return;
      }
      
      console.log(`Starting game with code ${gameCodeParam} for player ${playerId}`);
      
      // Clear leader cache before important API calls
      clearLeaderCache();
      
      // Get fresh leader URL
      const freshLeaderUrl = await getLeaderUrl();
      console.log(`Using fresh leader URL for game start: ${freshLeaderUrl}`);
      
      const response = await fetch(`${freshLeaderUrl}/lobby/start`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ 
          code: gameCodeParam, 
          player_id: playerId 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to start game");
      }
      
      console.log("Game start request successful");
      // The game start event will be broadcast via WebSocket to all clients
    } catch (error: any) {
      console.warn("⚠️ Start game issue:", error);
      setError(error.message || "Couldn't start game. Please try again.");
      
      // Try reconnecting WebSocket on error
      reconnect();
    }
  };

  // Display connection status for debugging
  const connectionStatus = connectionAttempts > 0 
    ? `Reconnecting (${connectionAttempts}/5)...` 
    : isConnected 
      ? "Connected" 
      : "Connecting...";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-8">
      <header className="mb-10 text-center">
        <h1 className="text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
          NexusQuiz Lobby
        </h1>
        <p className="text-xl text-purple-300 font-light">
          Game Code:{" "}
          <span className="font-semibold tracking-widest bg-gray-800 px-3 py-1 rounded-md shadow-inner">
            {gameCodeParam}
          </span>
        </p>
        <p className="text-sm mt-2">
          <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
            isConnected ? 'bg-green-500' : connectionAttempts > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
          }`}></span>
          {connectionStatus}
        </p>
      </header>

      <main className="w-full max-w-md bg-gray-800 bg-opacity-70 backdrop-filter backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-purple-700/50">
        <h2 className="text-2xl font-semibold mb-5 text-center text-purple-300 border-b border-purple-600/50 pb-3">
          Players in Lobby ({players.length})
        </h2>

        <ul className="space-y-3 mb-6 h-48 overflow-y-auto pr-2 custom-scrollbar">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between bg-gray-700/80 p-3 rounded-lg shadow hover:bg-gray-600/80 transition-colors duration-200"
            >
              <span className="font-medium text-lg text-gray-100">
                {player.name}
              </span>
              {player.name === playerName && (
                <span className="text-xs font-bold text-green-400">(You)</span>
              )}
              {isHost && player.name === playerName && (
                <span className="text-xs font-bold text-yellow-400">
                  (Host)
                </span>
              )}
            </li>
          ))}
        </ul>

        {isHost ? (
          <button
            onClick={handleStartGame}
            disabled={!isConnected}
            className={`w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transform transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-400 ${
              !isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
            }`}
          >
            Start Game!
          </button>
        ) : (
          <p className="text-center text-lg text-purple-300 italic animate-pulse">
            Waiting for the host to start the game...
          </p>
        )}

        {error && (
          <div className="mt-4 p-3 bg-purple-900/50 border border-purple-500/50 rounded-lg">
            <p className="text-purple-300 text-center">{error}</p>
            <button 
              onClick={reconnect}
              className="mt-2 text-sm underline text-purple-300 mx-auto block hover:text-purple-200"
            >
              Try reconnecting
            </button>
          </div>
        )}
      </main>

      <footer className="mt-8 text-center text-gray-500 text-sm">
        Powered by Next.js & FastAPI | © {new Date().getFullYear()} NexusQuiz
      </footer>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(55, 48, 163, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(167, 139, 250, 0.6);
          border-radius: 10px;
          border: 2px solid rgba(55, 48, 163, 0.3);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(167, 139, 250, 0.8);
        }
      `}</style>
    </div>
  );
}