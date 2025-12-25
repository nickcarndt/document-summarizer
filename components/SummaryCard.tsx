'use client';

interface SummaryCardProps {
  model: 'claude' | 'openai';
  content: string;
  latencyMs: number;
  referenceId: string;
  referenceType: 'summary' | 'query';
}

export default function SummaryCard({ model, content, latencyMs, referenceId, referenceType }: SummaryCardProps) {
  const handleFeedback = async (rating: 'up' | 'down') => {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceType,
          referenceId,
          model,
          rating,
        }),
      });
    } catch (error) {
      console.error('[FEEDBACK] Failed to submit:', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const modelName = model === 'claude' ? 'Claude' : 'OpenAI';
  const latencySeconds = (latencyMs / 1000).toFixed(1);

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">{modelName}</h3>
        <span className={`px-3 py-1 rounded-md text-sm font-medium ${
          model === 'claude' 
            ? 'bg-orange-500/20 text-orange-400' 
            : 'bg-green-500/20 text-green-400'
        }`}>
          {latencySeconds}s
        </span>
      </div>
      
      <div className="prose prose-invert max-w-none mb-4">
        <div className="text-gray-300 whitespace-pre-wrap">{content}</div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => handleFeedback('up')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          <span>Thumbs Up</span>
        </button>
        <button
          onClick={() => handleFeedback('down')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
          </svg>
          <span>Thumbs Down</span>
        </button>
      </div>
    </div>
  );
}

