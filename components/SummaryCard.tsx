'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import { formatLatency } from '@/lib/utils';

interface SummaryCardProps {
  model: 'claude' | 'openai';
  content: string;
  latencyMs: number;
  referenceId: string;
  referenceType: 'summary' | 'query';
}

export default function SummaryCard({ model, content, latencyMs, referenceId, referenceType }: SummaryCardProps) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (rating: 'up' | 'down') => {
    if (feedback !== null || isSubmitting) return; // Already voted or submitting
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceType,
          referenceId,
          model,
          rating,
        }),
      });

      if (response.ok) {
        setFeedback(rating);
        toast.success('Feedback recorded!');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save feedback. Please try again.');
        console.error('[FEEDBACK] Failed to submit:', data.error || 'Unknown error');
      }
    } catch (error) {
      toast.error('Failed to save feedback. Please try again.');
      console.error('[FEEDBACK] Failed to submit:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modelName = model === 'claude' ? 'Claude' : 'OpenAI';

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">{modelName}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium bg-gray-700 ${
          model === 'claude' 
            ? 'text-orange-400' 
            : 'text-green-400'
        }`}>
          {formatLatency(latencyMs)}
        </span>
      </div>
      
      <div className="prose prose-invert prose-sm max-w-none mb-4 text-gray-300">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => handleFeedback('up')}
          disabled={isSubmitting || feedback !== null}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${
            feedback === 'up'
              ? 'bg-green-600 text-white'
              : feedback === 'down'
              ? 'bg-gray-700 opacity-50 cursor-not-allowed'
              : 'bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          <span>{feedback === 'up' ? 'Voted!' : 'Thumbs Up'}</span>
        </button>
        <button
          onClick={() => handleFeedback('down')}
          disabled={isSubmitting || feedback !== null}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${
            feedback === 'down'
              ? 'bg-red-600 text-white'
              : feedback === 'up'
              ? 'bg-gray-700 opacity-50 cursor-not-allowed'
              : 'bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
          </svg>
          <span>{feedback === 'down' ? 'Voted!' : 'Thumbs Down'}</span>
        </button>
      </div>
    </div>
  );
}

