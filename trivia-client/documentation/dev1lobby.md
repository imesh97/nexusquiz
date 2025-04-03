# NexusQuiz Trivia Client 

## 🎮 Overview

This is the **frontend client** for a real-time, distributed multiplayer trivia game called NexusQuiz. The app is built using **Next.js 15** with **TypeScript**, styled with **Tailwind CSS**, and uses **Zustand** for state management.

*> 🧠 The backend will be written in **FastAPI**. As front-end engineers, we focus on the client experience and real-time interface.*

---

## 🛠 Tech Stack

- **Framework**: Next.js 15.2.4 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.0
- **State Management**: Zustand 5.0.3
- **Linting**: ESLint 9
- **Structure**: `src/` directory enabled
- **Image Optimization**: `next/image`
- **Alias**: `@/*` maps to `./src/*`
- **Dev Server**: Using Turbopack (`npm run dev --turbopack`)

---

## 📁 Project Structure

```
/trivia-client
├── public/                      # Static assets
├── src/
│   ├── app/                     # App Router pages
│   │   ├── page.tsx             # Home/Join route
│   │   ├── layout.tsx           # Root layout
│   │   └── game/                # Game routes
│   │       └── [gameCode]/      # Dynamic game lobby route
│   │           └── page.tsx     # Lobby page (player list, waiting area)
│   ├── components/              # Reusable components (planned)
│   ├── store/                   # Zustand state management
│   │   └── gameStore.ts         # Game state store
│   └── types/                   # Type definitions
│       └── game.ts              # Game-related type definitions
├── .eslintrc.mjs
├── tailwind.config.ts
├── postcss.config.js
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 🏗️ Implemented Features

### Pages
1. **Join Page** (`src/app/page.tsx`)
   - User input for nickname and game code
   - Form validation and error handling
   - Join game functionality using simulated backend
   - Responsive gradient background UI

2. **Lobby Page** (`src/app/game/[gameCode]/page.tsx`)
   - Dynamic route based on game code
   - Player list with real-time updates
   - Host controls for starting the game
   - "Bot Player" simulation for testing
   - Redirect protection for direct URL access

### State Management
1. **Game Store** (`src/store/gameStore.ts`)
   - Zustand store for global state management
   - Player information tracking
   - Game status management (joining → lobby → playing → finished)
   - Simulated backend API with `fakeFetchLobbyData()`
   - TypeScript interfaces for type safety

### Types
1. **Game Types** (`src/types/game.ts`)
   - Type definitions for Players, Game status
   - Interfaces for Questions, Answers, and Game rounds (future use)

---

## 🧩 State Management Structure

The Zustand store (`gameStore.ts`) manages:

- **Player State**:
  - `playerName`: Current user's name
  - `playerId`: Unique ID for the current user
  - `players`: Array of all players in the game
  - `isHost`: Boolean indicating if current user is the host

- **Game Status**:
  - `gameStatus`: 'joining' | 'lobby' | 'playing' | 'finished' | 'error'
  - `gameCode`: Code for the current game room
  - `errorMessage`: Error display handling

- **Actions**:
  - `initializeLobby`: Set up game after successful join
  - `addPlayer`: Add a new player to the game
  - `removePlayer`: Remove a player from the game
  - `startGame`: Transition from lobby to playing state
  - `resetGame`: Reset all state (used for errors or game exit)
  - `setError`: Handle error state

---

## 🔄 Game Flow

1. **Join Game** (Home Page):
   - User enters nickname and game code
   - Backend validates and assigns player ID
   - Store updates with player info
   - Redirect to lobby

2. **Lobby** (Wait Stage):
   - Players see a list of participants
   - Host sees "Start Game" button
   - New players trigger UI updates
   - Protected from direct URL access

3. **Game Start** (In Progress):
   - Host triggers game start
   - All players transition to playing state
   - UI navigates to game screen (in development)

4. **Game Play** (Planned):
   - Questions and answer selection
   - Real-time scoring
   - Leaderboard updates

---

## ✅ Setup & Run

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
```

---

## 📦 Dependencies

### Core
- `next`: 15.2.4
- `react`: 19.0.0
- `react-dom`: 19.0.0
- `zustand`: 5.0.3

### Dev
- `typescript`: 5.x
- `@types/react`: 19.x
- `@types/node`: 20.x
- `@types/react-dom`: 19.x
- `tailwindcss`: 4.x
- `@tailwindcss/postcss`: 4.x
- `eslint`: 9.x
- `eslint-config-next`: 15.2.4

---

## 🧑‍💻 Technical Details

### State Updates
The Zustand store uses a combination of direct state updates and computed values:

```typescript
// Example action to add a player
addPlayer: (player) => set((state: GameState) => {
  if (state.players.some(p => p.id === player.id)) {
    return {}; // No change if player already exists
  }
  return { players: [...state.players, player] };
}),
```

### Navigation
Next.js App Router handles navigation between pages, with programmatic navigation used for game flow:

```typescript
// Example of redirect after joining
router.push(`/game/${trimmedCode}`);
```

### Loading States
Uses React's `useTransition` hook for loading states:

```typescript
const [isPending, startTransition] = useTransition();
```

---

## 🚀 Next Steps

- [ ] Create `game/[gameCode]/play/page.tsx` for actual gameplay
- [ ] Implement WebSocket connections for real-time updates
- [ ] Add scoring system and leaderboard
- [ ] Create question display and answer selection UI
- [ ] Connect to actual FastAPI backend
- [ ] Add game timer functionality
- [ ] Implement user authentication/profiles
- [ ] Add sound effects and animations

---

## 📚 Coding Conventions

- Use **TypeScript** for all components and functions
- Use **Zustand** for state management
- Use **Tailwind** utility classes for styling
- Follow Next.js App Router patterns
- Use dynamic routes for game-specific pages
- Leverage TypeScript interfaces for type safety
- Simulate backend for frontend development