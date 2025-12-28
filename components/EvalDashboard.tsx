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
  winCounts?: {
    claude: number;
    openai: number;
    tie: number;
  };
  claudeThumbsUpRate: number;
  openaiThumbsUpRate: number;
  claudeAvgLatencyMs: number;
  openaiAvgLatencyMs: number;
  claudeAvgLength?: number;
  openaiAvgLength?: number;
  claudeAgreementRate?: number;
  openaiAgreementRate?: number;
  winRateByType?: {
    summaries: { claude: number; openai: number; tie: number; total: number };
    queries: { claude: number; openai: number; tie: number; total: number };
  };
  latencyDistribution?: {
    claude: { min: number; max: number; median: number; p95: number };
    openai: { min: number; max: number; median: number; p95: number };
  };
  costs?: {
    claude: number;
    openai: number;
  };
  recentComparisons: Array<{
    id: string;
    referenceType: string;
    winner: string;
    createdAt: string;
    questionPreview?: string | null;
  }>;
}

export default function EvalDashboard() {
  const [stats, setStats] = useState<EvalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'all' | '7days' | '30days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const getDateRangeParams = () => {
    if (dateRange === 'all') return '';
    
    const end = new Date();
    let start: Date;
    
    if (dateRange === '7days') {
      start = new Date();
      start.setDate(start.getDate() - 7);
    } else if (dateRange === '30days') {
      start = new Date();
      start.setDate(start.getDate() - 30);
    } else if (dateRange === 'custom') {
      if (!customStartDate || !customEndDate) return '';
      return `?startDate=${customStartDate}&endDate=${customEndDate}`;
    } else {
      return '';
    }
    
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    return `?startDate=${startStr}&endDate=${endStr}`;
  };

  useEffect(() => {
    if (dateRange !== 'custom') {
      fetchStats();
    }
    
    // Refetch on window focus (Option A)
    const handleFocus = () => {
      if (dateRange !== 'custom') {
        fetchStats();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const dateParams = getDateRangeParams();
      // Add cache-busting timestamp
      const params = new URLSearchParams();
      if (dateParams && dateParams.startsWith('?')) {
        const existingParams = new URLSearchParams(dateParams.substring(1));
        existingParams.forEach((value, key) => {
          params.set(key, value);
        });
      }
      params.set('_t', Date.now().toString()); // Cache buster
      
      const response = await fetch(`/api/evals?${params.toString()}&_t=${Date.now()}`, {
        cache: 'no-store',
        next: { revalidate: 0 }
      });
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
      console.log('[EvalDashboard] Received data:', {
        totalQueries: data.totalQueries,
        totalDocuments: data.totalDocuments,
        totalComparisons: data.totalComparisons
      });
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

  const handleExportJSON = async () => {
    try {
      const response = await fetch('/api/evals/export');
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eval-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export JSON:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  // Generate insights dynamically
  const generateInsights = (): string[] => {
    if (!stats) return [];
    
    const insights: string[] = [];
    
    // Win rate insight
    if (stats.totalComparisons > 0) {
      const preferredModel = stats.claudeWinRate > stats.openaiWinRate ? 'Claude' : 'OpenAI';
      const preferredRate = Math.max(stats.claudeWinRate, stats.openaiWinRate);
      if (preferredRate >= 55) {
        insights.push(`${preferredModel} preferred in <strong>${preferredRate}%</strong> of head-to-head comparisons`);
      }
    }
    
    // Response length insight
    if (stats.claudeAvgLength && stats.openaiAvgLength && stats.claudeAvgLength > 0 && stats.openaiAvgLength > 0) {
      const lengthDiff = ((stats.claudeAvgLength - stats.openaiAvgLength) / stats.openaiAvgLength) * 100;
      const longerModel = lengthDiff > 0 ? 'Claude' : 'OpenAI';
      const diffPercent = Math.abs(Math.round(lengthDiff));
      if (diffPercent >= 10) {
        insights.push(`${longerModel} responses average <strong>${diffPercent}% longer</strong> (${stats.claudeAvgLength.toLocaleString()} vs ${stats.openaiAvgLength.toLocaleString()} chars)`);
      }
    }
    
    // Latency insight
    if (stats.claudeAvgLatencyMs > 0 && stats.openaiAvgLatencyMs > 0) {
      const latencyRatio = stats.claudeAvgLatencyMs / stats.openaiAvgLatencyMs;
      const fasterModel = latencyRatio > 1 ? 'OpenAI' : 'Claude';
      const speedMultiplier = latencyRatio > 1 ? latencyRatio : 1 / latencyRatio;
      if (speedMultiplier >= 1.3) {
        insights.push(`${fasterModel} is <strong>${speedMultiplier.toFixed(1)}x faster</strong> (${(stats.openaiAvgLatencyMs / 1000).toFixed(1)}s vs ${(stats.claudeAvgLatencyMs / 1000).toFixed(1)}s average)`);
      }
    }
    
    // Thumbs up rate insight
    if (stats.claudeThumbsUpRate > 0 && stats.openaiThumbsUpRate > 0) {
      const rateDiff = Math.abs(stats.claudeThumbsUpRate - stats.openaiThumbsUpRate);
      if (rateDiff < 10) {
        insights.push(`Thumbs up rates are similar (${stats.claudeThumbsUpRate}% vs ${stats.openaiThumbsUpRate}%), suggesting both produce quality outputs`);
      }
    }
    
    return insights;
  };

  const insights = generateInsights();

  const handleDateRangeChange = (range: 'all' | '7days' | '30days' | 'custom') => {
    setDateRange(range);
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      fetchStats();
    }
  };

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-gray-400 text-sm font-medium">Filter by Date:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleDateRangeChange('all')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                dateRange === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => handleDateRangeChange('7days')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                dateRange === '7days'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => handleDateRangeChange('30days')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                dateRange === '30days'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => handleDateRangeChange('custom')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                dateRange === 'custom'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Custom Range
            </button>
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-gray-700 text-white rounded-md px-3 py-1.5 text-sm border border-gray-600"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-gray-700 text-white rounded-md px-3 py-1.5 text-sm border border-gray-600"
              />
              <button
                onClick={handleCustomDateApply}
                disabled={!customStartDate || !customEndDate}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-md text-sm transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Key Insights */}
      {insights.length > 0 && (
        <div className="bg-gray-800 border-l-4 border-orange-500 p-4 rounded-lg">
          <h3 className="text-white font-semibold mb-2">Key Insights</h3>
          <ul className="text-gray-300 text-sm space-y-1">
            {insights.map((insight, index) => (
              <li key={index} dangerouslySetInnerHTML={{ __html: `• ${insight}` }} />
            ))}
          </ul>
        </div>
      )}

      {/* Refresh and Export Buttons */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleExportJSON}
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
          Export Data (JSON)
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
              <span className="text-gray-300">
                {stats.claudeWinRate}% {stats.winCounts && `(${stats.winCounts.claude} wins)`}
              </span>
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
              <span className="text-gray-300">
                {stats.openaiWinRate}% {stats.winCounts && `(${stats.winCounts.openai} wins)`}
              </span>
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
              <span className="text-gray-300">
                {stats.tieRate}% {stats.winCounts && `(${stats.winCounts.tie} ties)`}
              </span>
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

      {/* Cost Tracking */}
      {stats.costs && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            Total Cost Incurred
            <InfoIcon tooltip="Cost calculated from summary generation only (queries don't have token data). Based on Claude Haiku and GPT-4o-mini pricing." />
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-gray-400 text-sm mb-1">Claude</p>
              <p className="text-3xl font-bold text-orange-400">
                ${stats.costs.claude.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">OpenAI</p>
              <p className="text-3xl font-bold text-green-400">
                ${stats.costs.openai.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

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
              <InfoIcon tooltip="Avg chars per response" />
            </h3>
            <p className="text-3xl font-bold text-orange-400">
              {stats.claudeAvgLength.toLocaleString()} chars
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              OpenAI Avg Response Length
              <InfoIcon tooltip="Avg chars per response" />
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
              <InfoIcon tooltip="When the winner also got thumbs up. Higher = more consistent preferences." />
            </h3>
            <p className="text-3xl font-bold text-orange-400">
              {stats.claudeAgreementRate}%
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              OpenAI Agreement Rate
              <InfoIcon tooltip="When the winner also got thumbs up. Higher = more consistent preferences." />
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
                {stats.winRateByType.queries.total >= 3 ? (
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
                ) : (
                  <tr>
                    <td className="py-2 px-4 font-medium">Q&A</td>
                    <td colSpan={3} className="py-2 px-4 text-center text-gray-500 text-sm">
                      Insufficient data (need 3+ comparisons, currently {stats.winRateByType.queries.total})
                    </td>
                  </tr>
                )}
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
                  <th className="text-left py-2 px-4 text-gray-400">Preview</th>
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
                    <td className="py-2 px-4 text-gray-400 text-xs max-w-xs truncate">
                      {comp.questionPreview || '-'}
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

