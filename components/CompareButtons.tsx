'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

interface CompareButtonsProps {
  referenceType: 'summary' | 'query';
  referenceId: string;
}

export default function CompareButtons({ referenceType, referenceId }: CompareButtonsProps) {
  const [selected, setSelected] = useState<'claude' | 'openai' | 'tie' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCompare = async (winner: 'claude' | 'openai' | 'tie') => {
    if (submitting || selected !== null) return; // Prevent changing vote

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
        toast.success('Vote recorded!');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save vote. Please try again.');
        console.error('Failed to submit comparison:', data.error);
      }
    } catch (error) {
      toast.error('Failed to save vote. Please try again.');
      console.error('Failed to submit comparison:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-gray-400">
        {selected ? 'Vote recorded!' : 'Which response is better?'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => handleCompare('claude')}
          disabled={submitting || (selected !== null && selected !== 'claude')}
          className={`px-6 py-2 rounded-md font-semibold transition-all ${
            selected === 'claude'
              ? 'bg-orange-600 text-white ring-2 ring-orange-400 ring-offset-2 ring-offset-gray-900'
              : selected !== null
              ? 'bg-gray-700 opacity-50 cursor-not-allowed text-gray-400'
              : 'bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50'
          }`}
        >
          {selected === 'claude' ? '✓ Claude Selected' : 'Claude is better'}
        </button>
        <button
          onClick={() => handleCompare('tie')}
          disabled={submitting || (selected !== null && selected !== 'tie')}
          className={`px-6 py-2 rounded-md font-semibold transition-all ${
            selected === 'tie'
              ? 'bg-gray-600 text-white ring-2 ring-gray-400 ring-offset-2 ring-offset-gray-900'
              : selected !== null
              ? 'bg-gray-700 opacity-50 cursor-not-allowed text-gray-400'
              : 'bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50'
          }`}
        >
          {selected === 'tie' ? '✓ Tie Selected' : 'Tie'}
        </button>
        <button
          onClick={() => handleCompare('openai')}
          disabled={submitting || (selected !== null && selected !== 'openai')}
          className={`px-6 py-2 rounded-md font-semibold transition-all ${
            selected === 'openai'
              ? 'bg-green-600 text-white ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900'
              : selected !== null
              ? 'bg-gray-700 opacity-50 cursor-not-allowed text-gray-400'
              : 'bg-green-500 hover:bg-green-600 text-white disabled:opacity-50'
          }`}
        >
          {selected === 'openai' ? '✓ OpenAI Selected' : 'OpenAI is better'}
        </button>
      </div>
    </div>
  );
}

