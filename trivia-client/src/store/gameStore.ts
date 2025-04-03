// src/store/gameStore.ts
import { create } from 'zustand';

export interface Player {
  id: string; // In real app, likely assigned by backend
  name: string;
}

export type GameStatus = 'joining' | 'lobby' | 'playing' | 'finished' | 'error';

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
  initializeLobby: (name: string, code: string, fetchedPlayers: Player[], ownId: string, hostStatus: boolean) => void;
  addPlayer: (player: Player) => void; // For simulation or websocket updates
  removePlayer: (playerId: string) => void; // For simulation or websocket updates
  setHost: (isHost: boolean) => void;
  startGame: () => void;
  setError: (message: string | null) => void;
  resetGame: () => void;
}

// --- Simulating Backend Interaction ---
// In a real application, these functions would involve API calls.
// We simulate finding a lobby and returning initial state.
export const fakeFetchLobbyData = async (code: string, playerName: string): Promise<{ players: Player[], newPlayerId: string, isHost: boolean } | null> => {
  console.log(`Simulating fetch for lobby: ${code} by ${playerName}`);
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

  // Simulate scenarios
  if (code === 'ERROR') {
    throw new Error("Invalid game code simulation");
  }
  if (code === 'FULL') {
     throw new Error("Lobby is full simulation");
  }

  // Simulate an existing lobby (or creating a new one)
  // In a real backend, you'd check if 'code' exists.
  // For simulation, let's assume joining is always possible unless code is 'ERROR'/'FULL'

  const newPlayerId = crypto.randomUUID(); // Simulate backend assigning ID
  const existingPlayers: Player[] = []; // Simulate fetching existing players (empty for now)

  // Simulate host logic (e.g., first person in *this simulated fetch* is host)
  // A real backend would have proper host assignment logic
  const isHost = existingPlayers.length === 0;

  return {
    players: [...existingPlayers, { id: newPlayerId, name: playerName }],
    newPlayerId: newPlayerId,
    isHost: isHost,
  };
};
// --- End Simulation ---


export const useGameStore = create<GameState>((set, get) => ({
  // Initial State
  playerName: null,
  gameCode: null,
  players: [],
  playerId: null, // Initialize client's player ID
  isHost: false,
  gameStatus: 'joining',
  errorMessage: null,

  // Actions
  setPlayerName: (name) => set({ playerName: name }),
  setGameCode: (code) => set({ gameCode: code }),
  setError: (message) => set({ errorMessage: message, gameStatus: message ? 'error' : get().gameStatus }), // Set error state

  // Action to initialize state after successfully "joining" (simulated)
  initializeLobby: (name, code, fetchedPlayers, ownId, hostStatus) => {
    set({
      playerName: name,
      gameCode: code,
      players: fetchedPlayers, // Set the list based on fetched data
      playerId: ownId,       // Store this client's ID
      isHost: hostStatus,    // Set host status based on fetched data
      gameStatus: 'lobby',   // Move to lobby state
      errorMessage: null,    // Clear any previous errors
    });
  },

  // Simulate adding another player (e.g., via WebSocket)
  addPlayer: (player) => set((state: GameState) => {
    // Avoid adding duplicates if the message is accidentally received multiple times
    if (state.players.some(p => p.id === player.id)) {
      return {}; // No change
    }
    return { players: [...state.players, player] };
  }),

  // Simulate removing another player
  removePlayer: (playerId) => set((state: GameState) => ({
    players: state.players.filter(p => p.id !== playerId),
    // Simple Host Reassignment Simulation: If the host leaves, assign the next player as host.
    // A real backend would handle this more robustly.
    isHost: state.isHost && state.playerId === playerId
      ? state.players.filter(p => p.id !== playerId)[0]?.id === state.playerId // Am I the next player?
      : state.isHost // Otherwise, keep current host status
  })),

  setHost: (isHost) => set({ isHost }), // Allow manual override if needed

  // Simulate host starting the game
  startGame: () => {
    if (get().isHost && get().gameStatus === 'lobby') {
      console.log('Frontend: Simulating game start command...');
      // In a real app, this would send a message to the server,
      // and the server would broadcast the 'playing' state change to all clients.
      set({ gameStatus: 'playing' });
      // TODO: Navigate to the actual game play screen
    }
  },

  resetGame: () => set({
    playerName: null,
    gameCode: null,
    players: [],
    playerId: null,
    isHost: false,
    gameStatus: 'joining',
    errorMessage: null,
  }),
}));