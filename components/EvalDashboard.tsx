'use client';

import { useEffect, useState } from 'react';
import { InfoIcon } from '@/components/Tooltip';

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
  claudeAvgLength?: number;
  openaiAvgLength?: number;
  claudeAgreementRate?: number;
  openaiAgreementRate?: number;
  winRateByType?: {
    summaries: { claude: number; openai: number; tie: number };
    queries: { claude: number; openai: number; tie: number };
  };
  latencyDistribution?: {
    claude: { min: number; max: number; median: number; p95: number };
    openai: { min: number; max: number; median: number; p95: number };
  };
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
    
    // Refetch on window focus (Option A)
    const handleFocus = () => {
      fetchStats();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
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

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/evals/export');
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eval-data-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Refresh and Export Buttons */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleExportCSV}
          className="text-sm text-gray-400 hover:text-white flex items-center gap-1 px-3 py-2 rounded-md hover:bg-gray-800 transition-colors"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export Data (CSV)
        </button>
        <button
          onClick={() => fetchStats()}
          className="text-sm text-gray-400 hover:text-white flex items-center gap-1 px-3 py-2 rounded-md hover:bg-gray-800 transition-colors"
          disabled={loading}
        >
          <svg 
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Total Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-400 text-sm mb-2">
            Total Documents
            <InfoIcon tooltip="Number of unique PDFs uploaded and processed" />
          </p>
          <p className="text-3xl font-bold">{stats.totalDocuments}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-400 text-sm mb-2">
            Total Queries
            <InfoIcon tooltip="Number of Q&A questions asked across all documents" />
          </p>
          <p className="text-3xl font-bold">{stats.totalQueries}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-400 text-sm mb-2">
            Total Comparisons
            <InfoIcon tooltip="Number of times a user voted on which response was better" />
          </p>
          <p className="text-3xl font-bold">{stats.totalComparisons}</p>
        </div>
      </div>

      {/* Win Rates */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">
          Win Rates
          <InfoIcon tooltip="Percentage of head-to-head comparisons won by each model" />
        </h3>
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
          <h3 className="text-lg font-semibold mb-4">
            Claude Thumbs Up Rate
            <InfoIcon tooltip="Percentage of Claude responses that received a thumbs up (absolute quality)" />
          </h3>
          <p className="text-3xl font-bold text-orange-400">{stats.claudeThumbsUpRate}%</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            OpenAI Thumbs Up Rate
            <InfoIcon tooltip="Percentage of OpenAI responses that received a thumbs up (absolute quality)" />
          </h3>
          <p className="text-3xl font-bold text-green-400">{stats.openaiThumbsUpRate}%</p>
        </div>
      </div>

      {/* Average Latencies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            Claude Avg Latency
            <InfoIcon tooltip="Average time to generate a Claude response, in seconds" />
          </h3>
          <p className="text-3xl font-bold text-orange-400">
            {stats.claudeAvgLatencyMs < 1000 
              ? `${Math.round(stats.claudeAvgLatencyMs)}ms`
              : `${(stats.claudeAvgLatencyMs / 1000).toFixed(1)}s`
            }
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            OpenAI Avg Latency
            <InfoIcon tooltip="Average time to generate an OpenAI response, in seconds" />
          </h3>
          <p className="text-3xl font-bold text-green-400">
            {stats.openaiAvgLatencyMs < 1000 
              ? `${Math.round(stats.openaiAvgLatencyMs)}ms`
              : `${(stats.openaiAvgLatencyMs / 1000).toFixed(1)}s`
            }
          </p>
        </div>
      </div>

      {/* 7a. Response Length Comparison */}
      {stats.claudeAvgLength !== undefined && stats.openaiAvgLength !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              Claude Avg Response Length
              <InfoIcon tooltip="Average character count of Claude responses. Longer isn't always better, but shows verbosity differences." />
            </h3>
            <p className="text-3xl font-bold text-orange-400">
              {stats.claudeAvgLength.toLocaleString()} chars
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              OpenAI Avg Response Length
              <InfoIcon tooltip="Average character count of OpenAI responses. Longer isn't always better, but shows verbosity differences." />
            </h3>
            <p className="text-3xl font-bold text-green-400">
              {stats.openaiAvgLength.toLocaleString()} chars
            </p>
          </div>
        </div>
      )}

      {/* 7b. Agreement Rate */}
      {stats.claudeAgreementRate !== undefined && stats.openaiAgreementRate !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              Claude Agreement Rate
              <InfoIcon tooltip="Percentage of times Claude won a comparison AND received a thumbs up. Shows consistency in user preferences." />
            </h3>
            <p className="text-3xl font-bold text-orange-400">
              {stats.claudeAgreementRate}%
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              OpenAI Agreement Rate
              <InfoIcon tooltip="Percentage of times OpenAI won a comparison AND received a thumbs up. Shows consistency in user preferences." />
            </h3>
            <p className="text-3xl font-bold text-green-400">
              {stats.openaiAgreementRate}%
            </p>
          </div>
        </div>
      )}

      {/* 7c. Win Rate by Type */}
      {stats.winRateByType && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            Win Rate by Type
            <InfoIcon tooltip="Breakdown of win rates for summaries vs Q&A responses. Shows if one model is better at certain tasks." />
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-4 text-gray-400">Type</th>
                  <th className="text-right py-2 px-4 text-gray-400">Claude</th>
                  <th className="text-right py-2 px-4 text-gray-400">OpenAI</th>
                  <th className="text-right py-2 px-4 text-gray-400">Tie</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-4 font-medium">Summaries</td>
                  <td className="py-2 px-4 text-right text-orange-400">
                    {stats.winRateByType.summaries.claude}%
                  </td>
                  <td className="py-2 px-4 text-right text-green-400">
                    {stats.winRateByType.summaries.openai}%
                  </td>
                  <td className="py-2 px-4 text-right text-gray-400">
                    {stats.winRateByType.summaries.tie}%
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-medium">Q&A</td>
                  <td className="py-2 px-4 text-right text-orange-400">
                    {stats.winRateByType.queries.claude}%
                  </td>
                  <td className="py-2 px-4 text-right text-green-400">
                    {stats.winRateByType.queries.openai}%
                  </td>
                  <td className="py-2 px-4 text-right text-gray-400">
                    {stats.winRateByType.queries.tie}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7d. Latency Distribution */}
      {stats.latencyDistribution && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              Claude Latency Distribution
              <InfoIcon tooltip="Performance metrics: Min, Max, Median (P50), and P95 latency values" />
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Min:</span>
                <span className="text-orange-400">
                  {stats.latencyDistribution.claude.min < 1000
                    ? `${stats.latencyDistribution.claude.min}ms`
                    : `${(stats.latencyDistribution.claude.min / 1000).toFixed(1)}s`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Median (P50):</span>
                <span className="text-orange-400">
                  {stats.latencyDistribution.claude.median < 1000
                    ? `${stats.latencyDistribution.claude.median}ms`
                    : `${(stats.latencyDistribution.claude.median / 1000).toFixed(1)}s`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">P95:</span>
                <span className="text-orange-400">
                  {stats.latencyDistribution.claude.p95 < 1000
                    ? `${stats.latencyDistribution.claude.p95}ms`
                    : `${(stats.latencyDistribution.claude.p95 / 1000).toFixed(1)}s`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max:</span>
                <span className="text-orange-400">
                  {stats.latencyDistribution.claude.max < 1000
                    ? `${stats.latencyDistribution.claude.max}ms`
                    : `${(stats.latencyDistribution.claude.max / 1000).toFixed(1)}s`}
                </span>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              OpenAI Latency Distribution
              <InfoIcon tooltip="Performance metrics: Min, Max, Median (P50), and P95 latency values" />
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Min:</span>
                <span className="text-green-400">
                  {stats.latencyDistribution.openai.min < 1000
                    ? `${stats.latencyDistribution.openai.min}ms`
                    : `${(stats.latencyDistribution.openai.min / 1000).toFixed(1)}s`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Median (P50):</span>
                <span className="text-green-400">
                  {stats.latencyDistribution.openai.median < 1000
                    ? `${stats.latencyDistribution.openai.median}ms`
                    : `${(stats.latencyDistribution.openai.median / 1000).toFixed(1)}s`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">P95:</span>
                <span className="text-green-400">
                  {stats.latencyDistribution.openai.p95 < 1000
                    ? `${stats.latencyDistribution.openai.p95}ms`
                    : `${(stats.latencyDistribution.openai.p95 / 1000).toFixed(1)}s`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max:</span>
                <span className="text-green-400">
                  {stats.latencyDistribution.openai.max < 1000
                    ? `${stats.latencyDistribution.openai.max}ms`
                    : `${(stats.latencyDistribution.openai.max / 1000).toFixed(1)}s`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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

