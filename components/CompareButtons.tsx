'use client';

import { useState } from 'react';

interface CompareButtonsProps {
  referenceType: 'summary' | 'query';
  referenceId: string;
}

export default function CompareButtons({ referenceType, referenceId }: CompareButtonsProps) {
  const [selected, setSelected] = useState<'claude' | 'openai' | 'tie' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCompare = async (winner: 'claude' | 'openai' | 'tie') => {
    if (submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceType,
          referenceId,
          winner,
        }),
      });

      if (response.ok) {
        setSelected(winner);
      }
    } catch (error) {
      console.error('Failed to submit comparison:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-gray-400">Which response is better?</p>
      <div className="flex gap-3">
        <button
          onClick={() => handleCompare('claude')}
          disabled={submitting}
          className={`px-6 py-2 rounded-md font-semibold transition-colors ${
            selected === 'claude'
              ? 'bg-orange-600 text-white'
              : 'bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50'
          }`}
        >
          Claude is better
        </button>
        <button
          onClick={() => handleCompare('tie')}
          disabled={submitting}
          className={`px-6 py-2 rounded-md font-semibold transition-colors ${
            selected === 'tie'
              ? 'bg-gray-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50'
          }`}
        >
          Tie
        </button>
        <button
          onClick={() => handleCompare('openai')}
          disabled={submitting}
          className={`px-6 py-2 rounded-md font-semibold transition-colors ${
            selected === 'openai'
              ? 'bg-green-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white disabled:opacity-50'
          }`}
        >
          OpenAI is better
        </button>
      </div>
    </div>
  );
}

