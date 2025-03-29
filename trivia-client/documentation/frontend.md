# Trivia Client Frontend

## 🎮 Overview

This is the **frontend client** for a real-time, distributed multiplayer trivia game. The app is built using **Next.js 15 (App Router)** and **TypeScript**, styled with **Tailwind CSS**, and uses **ESLint** for code quality.

---

## 🛠 Tech Stack

- **Framework**: Next.js 15.2.4 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Linting**: ESLint (`next/core-web-vitals` config)
- **Structure**: `src/` directory enabled
- **Image Optimization**: `next/image`
- **Alias**: `@/*` maps to `./src/*`
- **Dev Server**: Using Webpack (Turbopack disabled)

---

## 📁 Project Structure

```
/trivia-client
├── public/                  # Static assets
├── src/
│   ├── app/                 # App Router pages
│   │   ├── page.tsx         # Home route
│   │   ├── layout.tsx       # Root layout
│   │   └── game/            # Game routes (to be created)
│   ├── components/          # Reusable components (planned)
│   ├── styles/              # Tailwind/global styles
│   ├── hooks/               # Custom React hooks (planned)
│   ├── store/               # Zustand/Redux store (planned)
│   └── types/               # Type definitions (planned)
├── .eslintrc.mjs
├── tailwind.config.ts
├── postcss.config.js
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## ✅ Setup & Run

```bash
# Install dependencies
npm install

# Run local development server
npm run dev
```

---

## 🧱 Next Steps

- [ ] Create `game/lobby/page.tsx` – player list, start game, join code
- [ ] Set up `Zustand` or `Redux` for global state (player, game status, etc.)
- [ ] Add WebSocket integration
- [ ] Create `/game/play` and `/game/leaderboard` pages
- [ ] Style using Tailwind components

---

## 📦 Dependencies Installed

### Core
- `next`
- `react`, `react-dom`

### Dev
- `typescript`, `@types/react`, `@types/node`
- `tailwindcss`, `@tailwindcss/postcss`, `postcss`
- `eslint`, `eslint-config-next`, `@eslint/eslintrc`

---

## 📚 Conventions

- **Imports** use `@/` alias (maps to `/src`)
- Use **Tailwind** utility classes for all styling
- Organize pages under `src/app`
- Favor **server components** when no interactivity is needed

---

## ✨ Example Alias Import

```ts
import Button from "@/components/Button";
```

---

## 🧑‍💻 Dev Notes

This project was scaffolded using:
```bash
npx create-next-app@latest trivia-client --typescript
```

With the following options:
- ESLint: Yes
- Tailwind CSS: Yes
- `src/` directory: Yes
- App Router: Yes
- Turbopack: No
- Import alias: `@/*`

---

```
