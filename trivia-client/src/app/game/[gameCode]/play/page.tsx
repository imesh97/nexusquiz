// src/app/game/[gameCode]/play/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIndex: number; // for future scoring
}

// Simulated question data
const sampleQuestion: Question = {
  id: 1,
  text: 'What is the capital of France?',
  options: ['Madrid', 'Berlin', 'Paris', 'Rome'],
  correctIndex: 2,
};

export default function PlayPage() {
  const { gameCode } = useParams();
  const playerName = useGameStore((state) => state.playerName);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (!playerName || !gameCode) {
      // In a real app: redirect or error
      console.warn('Missing player or game info');
    }
  }, [playerName, gameCode]);

  const handleAnswer = (index: number) => {
    if (!answered) {
      setSelectedOption(index);
      setAnswered(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-8">
      <div className="w-full max-w-xl bg-gray-800 bg-opacity-70 backdrop-filter backdrop-blur-lg rounded-xl shadow-2xl p-8 border border-purple-700/50 text-center">
        <h1 className="text-3xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
          NexusQuiz - Round 1
        </h1>

        <p className="text-xl font-semibold mb-4 text-purple-300">
          {sampleQuestion.text}
        </p>

        <div className="grid grid-cols-1 gap-4 mb-6">
          {sampleQuestion.options.map((option, index) => {
            const isSelected = selectedOption === index;
            const isCorrect = sampleQuestion.correctIndex === index;
            const baseClass = 'px-6 py-4 rounded-lg text-lg font-medium transition-all duration-300';

            let colorClass =
              !answered
                ? 'bg-gray-700 hover:bg-purple-600'
                : isSelected
                ? isCorrect
                  ? 'bg-green-600'
                  : 'bg-red-600'
                : 'bg-gray-700 opacity-60';

            return (
              <button
                key={index}
                disabled={answered}
                onClick={() => handleAnswer(index)}
                className={`${baseClass} ${colorClass}`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {answered && (
          <p className="text-green-400 font-semibold animate-pulse">
            Answer locked in! 🎉
          </p>
        )}
      </div>

      <footer className="mt-8 text-center text-gray-500 text-sm">
        Powered by Next.js & FastAPI | © {new Date().getFullYear()} NexusQuiz
      </footer>
    </div>
  );
}
