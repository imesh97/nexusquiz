// src/store/gameStore.ts
import { create } from "zustand";

export interface Player {
  id: string; // In real app, likely assigned by backend
  name: string;
  score: number;
}

export type GameStatus = "joining" | "lobby" | "playing" | "finished" | "error";

export interface GameState {
  playerName: string | null;
  gameCode: string | null;
  players: Player[];
  playerId: string | null; // Added: Store the current client's player ID
  isHost: boolean;
  gameStatus: GameStatus; // Added 'error' state
  errorMessage: string | null; // Added for feedback
  setPlayerName: (name: string) => void;
  setGameCode: (code: string) => void;
  // Renamed for clarity, still simulates joining
  initializeLobby: (
    name: string,
    code: string,
    fetchedPlayers: Player[],
    ownId: string,
    hostStatus: boolean
  ) => void;
  addPlayer: (player: Player) => void; // For simulation or websocket updates
  removePlayer: (playerId: string) => void; // For simulation or websocket updates
  setHost: (isHost: boolean) => void;
  startGame: () => void;
  setError: (message: string | null) => void;
  resetGame: () => void;
  setPlayers: (players: Player[]) => void;
  setPlayerScore: (playerId: string, score: number) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  // Initial State
  playerName: null,
  gameCode: null,
  players: [],
  playerId: null, // Initialize client's player ID
  isHost: false,
  gameStatus: "joining",
  errorMessage: null,
  setPlayers: (players) => set({ players }),
  setPlayerScore: (playerId, score) =>
    set((state) => ({
      players: state.players.map((player) =>
        player.id === playerId ? { ...player, score } : player
      ),
    })),

  // Actions
  setPlayerName: (name) => set({ playerName: name }),
  setGameCode: (code) => set({ gameCode: code }),
  setError: (message) =>
    set({
      errorMessage: message,
      gameStatus: message ? "error" : get().gameStatus,
    }), // Set error state

  // Action to initialize state after successfully "joining" (simulated)
  initializeLobby: (name, code, fetchedPlayers, ownId, hostStatus) => {
    set({
      playerName: name,
      gameCode: code,
      players: fetchedPlayers, // Set the list based on fetched data
      playerId: ownId, // Store this client's ID
      isHost: hostStatus, // Set host status based on fetched data
      gameStatus: "lobby", // Move to lobby state
      errorMessage: null, // Clear any previous errors
    });
  },

  // Simulate adding another player (e.g., via WebSocket)
  addPlayer: (player) =>
    set((state: GameState) => {
      // Avoid adding duplicates if the message is accidentally received multiple times
      if (state.players.some((p) => p.id === player.id)) {
        return {}; // No change
      }
      return { players: [...state.players, player] };
    }),

  // Simulate removing another player
  removePlayer: (playerId) =>
    set((state: GameState) => ({
      players: state.players.filter((p) => p.id !== playerId),
      // Simple Host Reassignment Simulation: If the host leaves, assign the next player as host.
      // A real backend would handle this more robustly.
      isHost:
        state.isHost && state.playerId === playerId
          ? state.players.filter((p) => p.id !== playerId)[0]?.id ===
            state.playerId // Am I the next player?
          : state.isHost, // Otherwise, keep current host status
    })),

  setHost: (isHost) => set({ isHost }), // Allow manual override if needed

  // Simulate host starting the game
  startGame: () => {
    if (get().isHost && get().gameStatus === "lobby") {
      console.log("Frontend: Simulating game start command...");
      // In a real app, this would send a message to the server,
      // and the server would broadcast the 'playing' state change to all clients.
      set({ gameStatus: "playing" });
      // TODO: Navigate to the actual game play screen
    }
  },

  resetGame: () =>
    set({
      playerName: null,
      gameCode: null,
      players: [],
      playerId: null,
      isHost: false,
      gameStatus: "joining",
      errorMessage: null,
    }),
}));
