'use client';

import { useState } from 'react';
import SideBySide from './SideBySide';

interface QAChatProps {
  documentId: string;
}

interface QAExchange {
  question: string;
  claude: { content: string; latencyMs: number };
  openai: { content: string; latencyMs: number };
  queryId: string;
}

export default function QAChat({ documentId }: QAChatProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [exchanges, setExchanges] = useState<QAExchange[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          question: question.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Query failed');
      }

      const data = await response.json();
      setExchanges([
        ...exchanges,
        {
          question: question.trim(),
          claude: data.claude,
          openai: data.openai,
          queryId: data.queryId,
        },
      ]);
      setQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process query');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Ask a question about the document
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter your question..."
            className="flex-1 bg-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!question.trim() || loading}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors"
          >
            {loading ? 'Processing...' : 'Ask'}
          </button>
        </div>
        {error && (
          <div className="mt-3 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
            {error}
          </div>
        )}
      </form>

      <div className="space-y-8">
        {exchanges.map((exchange, index) => (
          <div key={index} className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-300 font-medium">Q: {exchange.question}</p>
            </div>
            <SideBySide
              claude={exchange.claude}
              openai={exchange.openai}
              referenceType="query"
              referenceId={exchange.queryId}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

