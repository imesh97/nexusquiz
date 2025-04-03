// src/app/game/[gameCode]/play/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
}

const sampleQuestion: Question = {
  id: 1,
  text: 'What is the capital of France?',
  options: ['Madrid', 'Berlin', 'Paris', 'Rome'],
  correctIndex: 2,
};

const TIMER_DURATION = 10; // seconds

export default function PlayPage() {
  const { gameCode } = useParams();
  const playerName = useGameStore((state) => state.playerName);
  const players = useGameStore((state) => state.players);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!playerName || !gameCode) {
      console.warn('Missing player or game info');
    }
  }, [playerName, gameCode]);

  useEffect(() => {
    if (timeLeft <= 0) {
      setShowResults(true);
      return;
    }
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  const handleAnswer = (index: number) => {
    if (!answered && !showResults) {
      setSelectedOption(index);
      setAnswered(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-8">
      <div className="w-full max-w-xl bg-gray-800 bg-opacity-70 backdrop-filter backdrop-blur-lg rounded-xl shadow-2xl p-8 border border-purple-700/50 text-center">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
            NexusQuiz - Round 1
          </h1>
          <div className="text-sm bg-black text-green-400 px-3 py-1 rounded-md shadow-inner animate-pulse font-mono">
            ⏳ {timeLeft}s
          </div>
        </div>

        <p className="text-xl font-semibold mb-4 text-purple-300">
          {sampleQuestion.text}
        </p>

        <div className="grid grid-cols-1 gap-4 mb-6">
          {sampleQuestion.options.map((option, index) => {
            const isSelected = selectedOption === index;
            const isCorrect = sampleQuestion.correctIndex === index;
            const isAnswerReveal = showResults;

            const baseClass =
              'px-6 py-4 rounded-lg text-lg font-medium transition-all duration-300';

            let colorClass = 'bg-gray-700';

            if (isAnswerReveal) {
              colorClass = isCorrect
                ? 'bg-green-600'
                : isSelected
                ? 'bg-red-600'
                : 'bg-gray-700 opacity-50';
            } else if (!answered) {
              colorClass = 'hover:bg-purple-600';
            } else if (isSelected) {
              colorClass = 'bg-gray-600';
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
              ✅ Correct Answer: {sampleQuestion.options[sampleQuestion.correctIndex]}
            </p>
            <div className="text-sm text-purple-300 italic">
              <p className="mb-1">Players answered:</p>
              <ul className="list-disc list-inside space-y-1">
                {players.map((player) => (
                  <li key={player.id} className="text-white">
                    {player.name} {player.name === playerName && <span className="text-green-400">(You)</span>} — <span className="italic text-gray-400">answered</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <footer className="mt-8 text-center text-gray-500 text-sm">
        Powered by Next.js & FastAPI | © {new Date().getFullYear()} NexusQuiz
      </footer>
    </div>
  );
}
