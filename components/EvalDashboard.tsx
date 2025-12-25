'use client';

import { useEffect, useState } from 'react';

interface EvalStats {
  totalDocuments: number;
  totalQueries: number;
  totalComparisons: number;
  claudeWinRate: number;
  openaiWinRate: number;
  tieRate: number;
  claudeThumbsUpRate: number;
  openaiThumbsUpRate: number;
  claudeAvgLatencyMs: number;
  openaiAvgLatencyMs: number;
  recentComparisons: Array<{
    id: string;
    referenceType: string;
    winner: string;
    createdAt: string;
  }>;
}

export default function EvalDashboard() {
  const [stats, setStats] = useState<EvalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/evals');
      if (!response.ok) {
        let errorMessage = 'Failed to fetch stats';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          
          // Check if it's a database error
          if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
            errorMessage = 'Database not initialized. Please run database migrations first.';
          }
        } catch (parseError) {
          // If response isn't JSON, use status text
          errorMessage = response.statusText || `Server error (${response.status})`;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load stats';
      setError(errorMessage);
      console.error('[EvalDashboard] Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <div className="inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-red-400 mb-4">
          <p className="font-semibold mb-2">Error: {error || 'Failed to load stats'}</p>
          {error?.includes('Database not initialized') && (
            <div className="mt-4 p-4 bg-gray-900 rounded-md border border-gray-700">
              <p className="text-sm text-gray-300 mb-2">To fix this issue:</p>
              <ol className="list-decimal list-inside text-sm text-gray-400 space-y-1">
                <li>Enable pgvector extension in Neon: <code className="bg-gray-800 px-1 rounded">CREATE EXTENSION IF NOT EXISTS vector;</code></li>
                <li>Run migrations: <code className="bg-gray-800 px-1 rounded">npm run db:generate && npm run db:migrate</code></li>
              </ol>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-400 text-sm mb-2">Total Documents</p>
          <p className="text-3xl font-bold">{stats.totalDocuments}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-400 text-sm mb-2">Total Queries</p>
          <p className="text-3xl font-bold">{stats.totalQueries}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-400 text-sm mb-2">Total Comparisons</p>
          <p className="text-3xl font-bold">{stats.totalComparisons}</p>
        </div>
      </div>

      {/* Win Rates */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Win Rates</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-orange-400">Claude</span>
              <span className="text-gray-300">{stats.claudeWinRate}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4">
              <div
                className="bg-orange-500 h-4 rounded-full"
                style={{ width: `${stats.claudeWinRate}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-green-400">OpenAI</span>
              <span className="text-gray-300">{stats.openaiWinRate}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4">
              <div
                className="bg-green-500 h-4 rounded-full"
                style={{ width: `${stats.openaiWinRate}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Tie</span>
              <span className="text-gray-300">{stats.tieRate}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4">
              <div
                className="bg-gray-500 h-4 rounded-full"
                style={{ width: `${stats.tieRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Thumbs Up Rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Claude Thumbs Up Rate</h3>
          <p className="text-3xl font-bold text-orange-400">{stats.claudeThumbsUpRate}%</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">OpenAI Thumbs Up Rate</h3>
          <p className="text-3xl font-bold text-green-400">{stats.openaiThumbsUpRate}%</p>
        </div>
      </div>

      {/* Average Latencies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Claude Avg Latency</h3>
          <p className="text-3xl font-bold text-orange-400">
            {stats.claudeAvgLatencyMs < 1000 
              ? `${Math.round(stats.claudeAvgLatencyMs)}ms`
              : `${(stats.claudeAvgLatencyMs / 1000).toFixed(1)}s`
            }
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">OpenAI Avg Latency</h3>
          <p className="text-3xl font-bold text-green-400">
            {stats.openaiAvgLatencyMs < 1000 
              ? `${Math.round(stats.openaiAvgLatencyMs)}ms`
              : `${(stats.openaiAvgLatencyMs / 1000).toFixed(1)}s`
            }
          </p>
        </div>
      </div>

      {/* Recent Comparisons */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Comparisons</h3>
        {stats.recentComparisons.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="mb-2">No comparisons yet</p>
            <p className="text-sm">Upload a document and vote on responses to see data here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-4 text-gray-400">Type</th>
                  <th className="text-left py-2 px-4 text-gray-400">Winner</th>
                  <th className="text-left py-2 px-4 text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentComparisons.map((comp) => (
                  <tr key={comp.id} className="border-b border-gray-700">
                    <td className="py-2 px-4 capitalize">{comp.referenceType}</td>
                    <td className="py-2 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          comp.winner === 'claude'
                            ? 'bg-orange-500/20 text-orange-400'
                            : comp.winner === 'openai'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {comp.winner === 'tie' ? 'Tie' : comp.winner.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-gray-400">
                      {new Date(comp.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

