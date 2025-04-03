// src/app/page.tsx
'use client';

import { useState, useTransition } from 'react'; // Import useTransition
import { useRouter } from 'next/navigation';
import { useGameStore, fakeFetchLobbyData, GameState } from '@/store/gameStore'; // Import GameState type

export default function JoinPage() {
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [isPending, startTransition] = useTransition(); // Hook for loading state without blocking UI
  const router = useRouter();

  // Get state setting actions and error state from store with explicit typing
  const initializeLobby = useGameStore((state: GameState) => state.initializeLobby);
  const setError = useGameStore((state: GameState) => state.setError);
  const errorMessage = useGameStore((state: GameState) => state.errorMessage);
  const resetGame = useGameStore((state: GameState) => state.resetGame); // Get reset action

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Clear previous errors

    const trimmedNickname = nickname.trim();
    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedNickname || !trimmedCode) {
       setError('Please enter both a nickname and a game code.');
       return; // Stop execution
    }

    // Start transition for loading state
    startTransition(async () => {
      try {
        // --- Simulate Backend Call ---
        // Replace this with your actual API call
        const lobbyData = await fakeFetchLobbyData(trimmedCode, trimmedNickname);
        // --- End Simulation ---

        if (lobbyData) {
          // Update Zustand store with data received (simulated) from backend
          initializeLobby(
            trimmedNickname,
            trimmedCode,
            lobbyData.players,
            lobbyData.newPlayerId,
            lobbyData.isHost
          );
          // Navigate to the lobby page
          router.push(`/game/${trimmedCode}`);
        } else {
           // This case might happen if fakeFetchLobbyData could return null
           // (although the current simulation throws errors instead)
           setError('Could not find or join the lobby.');
        }
      } catch (error: any) {
         // Handle errors from the simulated fetch
         console.error("Join failed:", error);
         setError(error.message || 'An unexpected error occurred.');
         // Optionally reset parts of the state if join fails completely
         // resetGame(); // Uncomment if you want to clear everything on error
      }
    });
  };

  // Clear error when user starts typing again
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
      setter(value);
      if (errorMessage) {
          setError(null);
      }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-8">
      <div className="text-center mb-12">
         <h1 className="text-6xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
          NexusQuiz
        </h1>
        <p className="text-xl text-purple-300 font-light">
          Join the Showdown!
        </p>
      </div>

      <form
        onSubmit={handleJoin}
        className="w-full max-w-sm bg-gray-800 bg-opacity-70 backdrop-filter backdrop-blur-lg rounded-xl shadow-2xl p-8 border border-purple-700/50"
      >
        {/* Nickname Input */}
        <div className="mb-6">
          <label htmlFor="nickname" className="block mb-2 text-sm font-medium text-purple-300">
            Choose Your Nickname
          </label>
          <input
            type="text"
            id="nickname"
            value={nickname}
            onChange={(e) => handleInputChange(setNickname, e.target.value)} // Use wrapper function
            maxLength={16}
            className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition duration-200 ${
                errorMessage && !nickname.trim() ? 'border-red-500 ring-red-500' : 'border-gray-600 focus:ring-purple-500' // Highlight if error and empty
            }`}
            placeholder="e.g., QuizMasterFlex"
            required
            aria-describedby={errorMessage && !nickname.trim() ? "error-message" : undefined} // For accessibility
          />
        </div>

        {/* Game Code Input */}
        <div className="mb-6"> {/* Adjusted margin */}
          <label htmlFor="gameCode" className="block mb-2 text-sm font-medium text-purple-300">
            Enter Game Code
          </label>
          <input
            type="text"
            id="gameCode"
            value={code}
            onChange={(e) => handleInputChange(setCode, e.target.value.toUpperCase())} // Force uppercase on change & use wrapper
            maxLength={6}
            className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition duration-200 uppercase tracking-widest text-center font-mono text-lg ${
                 errorMessage && !code.trim() ? 'border-red-500 ring-red-500' : 'border-gray-600 focus:ring-purple-500' // Highlight if error and empty
            }`}
            placeholder="ABCXYZ"
            required
            style={{ textTransform: 'uppercase' }}
            aria-describedby={errorMessage && !code.trim() ? "error-message" : undefined} // For accessibility
          />
        </div>

        {/* Error Message Area */}
        {errorMessage && (
            <p id="error-message" className="text-red-400 text-sm text-center mb-4" role="alert">
                {errorMessage}
            </p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending} // Disable button when pending
          className={`w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transform transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-pink-400 ${
            isPending
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:from-pink-600 hover:to-purple-700 hover:scale-105'
          }`}
        >
          {isPending ? 'Joining...' : 'Join Lobby'} {/* Change text when pending */}
        </button>
      </form>

      <footer className="mt-12 text-center text-gray-500 text-sm">
         © {new Date().getFullYear()} NexusQuiz
      </footer>
    </div>
  );
}