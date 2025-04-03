
# 🎮 NexusQuiz Trivia Client (Frontend)

This is the **frontend client** for **NexusQuiz**, a distributed multiplayer trivia game. Built with **Next.js 15** and **TypeScript**, styled using **Tailwind CSS**, and managed globally with **Zustand**.

> 🧠 Backend will be powered by **FastAPI**. This repo focuses on the real-time, reactive frontend experience.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15.2.4 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.0
- **State Management**: Zustand 5.0.3
- **Linting**: ESLint 9
- **Directory Structure**: `src/` enabled
- **Image Optimization**: `next/image`
- **Aliases**: `@/*` maps to `src/*`
- **Dev Tooling**: Turbopack (`npm run dev --turbopack`)

---

## 📁 Project Structure

```
/trivia-client
├── public/
├── src/
│   ├── app/
│   │   ├── page.tsx                      # Join page (lobby entry)
│   │   ├── layout.tsx                    # Global layout
│   │   └── game/
│   │       └── [gameCode]/
│   │           ├── page.tsx              # Lobby page (updated)
│   │           └── play/page.tsx         # [Planned] Game play screen
│   ├── components/                       # [Planned] Shared components
│   ├── store/
│   │   └── gameStore.ts                  # Zustand game state store
│   └── types/
│       └── game.ts                       # Game-related type definitions
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## ✅ Key Fix: Zustand Infinite Render Bug

When using Zustand with selectors like:

```tsx
const { playerName, gameCode } = useGameStore((state) => ({ ... }));
```

This causes an **infinite loop** in React because it creates a **new object reference** on every render. ✅ **Fixed by subscribing to each slice individually**:

```tsx
const playerName = useGameStore((state) => state.playerName);
const gameCode = useGameStore((state) => state.gameCode);
// etc.
```

> 🧠 This ensures only specific state changes trigger a re-render.

---

## ✨ Design Guidelines

The visual theme is inspired by **sci-fi neon** and **cyberpunk tech** aesthetics to fit the "Nexus" brand:

| Element        | Design Choice                                             |
|----------------|-----------------------------------------------------------|
| Background     | Radial gradient from gray → purple → black                |
| Typography     | Futuristic bold + mono typefaces with gradient text       |
| Colors         | Neon purples, teals, greens with glowing shadows          |
| Effects        | `backdrop-blur`, `opacity`, hover/scale transitions       |
| Components     | Soft rounded corners, subtle borders, glowing outlines    |
| Accessibility  | ARIA labels + contrast-compliant focus indicators         |

> 🔮 *Keep things clean, mysterious, and reactive — like a high-tech quiz arena.*

---

## 🏗️ Implemented Features

### ✅ Pages

#### `/src/app/page.tsx` → Join Page

- Nickname + Game Code input (with validation)
- Loading state using `useTransition`
- Error handling using Zustand
- Redirects to `/game/[code]` upon success

#### `/src/app/game/[gameCode]/page.tsx` → Lobby Page

- **Uses dynamic routing** with `useParams`
- Zustand-powered player list
- Host-only "Start Game" button
- Simulated bot join
- Fixed infinite loop issue by **isolating selectors**
- Auto-navigation to `/play` if `gameStatus === 'playing'`

---

## 🔄 Game Flow

1. **Join Game**
   - User enters nickname and game code
   - Simulated API returns `players`, `playerId`, and `hostStatus`
   - Zustand store is populated
   - Redirect to lobby

2. **Lobby**
   - See real-time list of players
   - Host can start the game
   - Lobby is protected from direct URL access

3. **Game Start**
   - When host starts game, state changes to `"playing"`
   - All users auto-navigate to `/game/[code]/play`

4. **Game Play** *(Coming Soon)*
   - Question rendering
   - Timed answer selection
   - Real-time score updates and leaderboard

---

## 🧠 State Architecture (Zustand)

### `/src/store/gameStore.ts`

```ts
interface GameState {
  playerName: string | null;
  gameCode: string | null;
  players: Player[];
  playerId: string | null;
  isHost: boolean;
  gameStatus: 'joining' | 'lobby' | 'playing' | 'finished' | 'error';
  errorMessage: string | null;
  // Actions:
  initializeLobby(...), addPlayer(...), removePlayer(...), etc.
}
```

✅ `fakeFetchLobbyData()` simulates a backend call, returning mocked player state and role.

---

## 🧪 Simulated Backend (for Frontend Dev)

Located in `gameStore.ts`, `fakeFetchLobbyData()` simulates:

- Valid game joins
- Host assignment
- Join errors (`"ERROR"` or `"FULL"` codes)
- Simulated player IDs

---

## 🧑‍💻 Coding Practices

- Use **TypeScript** in all files
- Use **Zustand** for global state
- Leverage **App Router** for navigation
- **No selector object patterns** with Zustand — pull state values individually
- Use `useTransition()` for async UI actions (e.g., joining)

---

## 🚀 Next Steps

- [ ] Build `/game/[gameCode]/play/page.tsx` screen
- [ ] Implement WebSocket syncing
- [ ] Add quiz question rendering + answers
- [ ] Implement countdown timers
- [ ] Add leaderboard
- [ ] Animate transitions and effects
- [ ] FastAPI backend connection

---

## 🔧 Setup & Run

```bash
# Install deps
npm install

# Run dev server
npm run dev

# Build for prod
npm run build

# Run lint checks
npm run lint
```

---

## 📦 Core Dependencies

```json
"next": "15.2.4",
"react": "19.0.0",
"react-dom": "19.0.0",
"zustand": "5.0.3",
"tailwindcss": "4.x",
"eslint": "9.x",
"typescript": "5.x"
```



🧠 **TL;DR:** NexusQuiz is a futuristic trivia platform with clean state management, glowing UI, and robust architecture. We’ve squashed the Zustand infinite loop, nailed the aesthetic, and are ready to play.
