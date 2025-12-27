import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, queries, summaries, feedback, comparisons } from '@/db/schema';
import { sql, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    logger.info('Fetching eval stats', 'EVALS');
    
    // Total counts
    const [docCount] = await db.select({ count: sql<number>`count(*)` }).from(documents);
    const [queryCount] = await db.select({ count: sql<number>`count(*)` }).from(queries);
    const [comparisonCount] = await db.select({ count: sql<number>`count(*)` }).from(comparisons);
    
    logger.debug('Counts retrieved', 'EVALS', { 
      documents: Number(docCount.count),
      queries: Number(queryCount.count),
      comparisons: Number(comparisonCount.count)
    });
    
    // Win rates
    const comparisonResults = await db.select().from(comparisons);
    const claudeWins = comparisonResults.filter(c => c.winner === 'claude').length;
    const openaiWins = comparisonResults.filter(c => c.winner === 'openai').length;
    const ties = comparisonResults.filter(c => c.winner === 'tie').length;
    const totalComparisons = comparisonResults.length || 1; // Avoid division by zero
    
    // Thumbs up rates
    const feedbackResults = await db.select().from(feedback);
    const claudeFeedback = feedbackResults.filter(f => f.model === 'claude');
    const openaiFeedback = feedbackResults.filter(f => f.model === 'openai');
    
    const claudeThumbsUp = claudeFeedback.filter(f => f.rating === 'up').length;
    const openaiThumbsUp = openaiFeedback.filter(f => f.rating === 'up').length;
    
    // Average latencies - Get from BOTH summaries and queries
    const allSummaries = await db.select().from(summaries);
    const allQueries = await db.select().from(queries);
    
    // Summary latencies
    const claudeSummaryLatencies = allSummaries
      .filter(s => s.model === 'claude')
      .map(s => s.latencyMs);
    const openaiSummaryLatencies = allSummaries
      .filter(s => s.model === 'openai')
      .map(s => s.latencyMs);
    
    // Query latencies
    const claudeQueryLatencies = allQueries.map(q => q.claudeLatencyMs);
    const openaiQueryLatencies = allQueries.map(q => q.openaiLatencyMs);
    
    // Combine all latencies
    const allClaudeLatencies = [...claudeSummaryLatencies, ...claudeQueryLatencies];
    const allOpenaiLatencies = [...openaiSummaryLatencies, ...openaiQueryLatencies];
    
    const avgClaudeLatency = allClaudeLatencies.length 
      ? allClaudeLatencies.reduce((a, b) => a + b, 0) / allClaudeLatencies.length 
      : 0;
    const avgOpenaiLatency = allOpenaiLatencies.length 
      ? allOpenaiLatencies.reduce((a, b) => a + b, 0) / allOpenaiLatencies.length 
      : 0;
    
    // Debug logging (temporary)
    logger.debug('Latency calculation', 'EVALS', {
      summariesCount: allSummaries.length,
      queriesCount: allQueries.length,
      claudeSummaryLatencies: claudeSummaryLatencies.length,
      openaiSummaryLatencies: openaiSummaryLatencies.length,
      claudeQueryLatencies: claudeQueryLatencies.length,
      openaiQueryLatencies: openaiQueryLatencies.length,
      allClaudeLatencies: allClaudeLatencies,
      allOpenaiLatencies: allOpenaiLatencies,
      avgClaudeLatency: Math.round(avgClaudeLatency),
      avgOpenaiLatency: Math.round(avgOpenaiLatency)
    });
    
    // Recent comparisons
    const recentComparisons = await db
      .select({
        id: comparisons.id,
        referenceType: comparisons.referenceType,
        winner: comparisons.winner,
        createdAt: comparisons.createdAt
      })
      .from(comparisons)
      .orderBy(desc(comparisons.createdAt))
      .limit(10);
    
    // 7a. Response Length Comparison
    const claudeSummaryLengths = allSummaries
      .filter(s => s.model === 'claude')
      .map(s => s.content.length);
    const openaiSummaryLengths = allSummaries
      .filter(s => s.model === 'openai')
      .map(s => s.content.length);
    const claudeQueryLengths = allQueries.map(q => q.claudeResponse.length);
    const openaiQueryLengths = allQueries.map(q => q.openaiResponse.length);
    
    const allClaudeLengths = [...claudeSummaryLengths, ...claudeQueryLengths];
    const allOpenaiLengths = [...openaiSummaryLengths, ...openaiQueryLengths];
    
    const claudeAvgLength = allClaudeLengths.length
      ? Math.round(allClaudeLengths.reduce((a, b) => a + b, 0) / allClaudeLengths.length)
      : 0;
    const openaiAvgLength = allOpenaiLengths.length
      ? Math.round(allOpenaiLengths.reduce((a, b) => a + b, 0) / allOpenaiLengths.length)
      : 0;
    
    // 7b. Agreement Rate - When Claude wins comparison, what % also got thumbs up?
    // When OpenAI wins comparison, what % also got thumbs up?
    let claudeAgreementCount = 0;
    let claudeWinCount = 0;
    let openaiAgreementCount = 0;
    let openaiWinCount = 0;
    
    for (const comp of comparisonResults) {
      if (comp.winner === 'claude') {
        claudeWinCount++;
        // Check if Claude got thumbs up for this reference
        const claudeFeedbackForRef = feedbackResults.find(
          f => f.referenceType === comp.referenceType && 
               f.referenceId === comp.referenceId && 
               f.model === 'claude' && 
               f.rating === 'up'
        );
        if (claudeFeedbackForRef) {
          claudeAgreementCount++;
        }
      } else if (comp.winner === 'openai') {
        openaiWinCount++;
        // Check if OpenAI got thumbs up for this reference
        const openaiFeedbackForRef = feedbackResults.find(
          f => f.referenceType === comp.referenceType && 
               f.referenceId === comp.referenceId && 
               f.model === 'openai' && 
               f.rating === 'up'
        );
        if (openaiFeedbackForRef) {
          openaiAgreementCount++;
        }
      }
    }
    
    const claudeAgreementRate = claudeWinCount > 0
      ? Math.round((claudeAgreementCount / claudeWinCount) * 100)
      : 0;
    const openaiAgreementRate = openaiWinCount > 0
      ? Math.round((openaiAgreementCount / openaiWinCount) * 100)
      : 0;
    
    // 7c. Win Rate by Type (Summary vs Q&A)
    const summaryComparisons = comparisonResults.filter(c => c.referenceType === 'summary');
    const queryComparisons = comparisonResults.filter(c => c.referenceType === 'query');
    
    const summaryClaudeWins = summaryComparisons.filter(c => c.winner === 'claude').length;
    const summaryOpenaiWins = summaryComparisons.filter(c => c.winner === 'openai').length;
    const summaryTies = summaryComparisons.filter(c => c.winner === 'tie').length;
    const summaryTotal = summaryComparisons.length || 1;
    
    const queryClaudeWins = queryComparisons.filter(c => c.winner === 'claude').length;
    const queryOpenaiWins = queryComparisons.filter(c => c.winner === 'openai').length;
    const queryTies = queryComparisons.filter(c => c.winner === 'tie').length;
    const queryTotal = queryComparisons.length || 1;
    
    // 7d. Latency Distribution
    const sortedClaudeLatencies = [...allClaudeLatencies].sort((a, b) => a - b);
    const sortedOpenaiLatencies = [...allOpenaiLatencies].sort((a, b) => a - b);
    
    const getPercentile = (arr: number[], percentile: number): number => {
      if (arr.length === 0) return 0;
      const index = Math.ceil((percentile / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };
    
    const response = NextResponse.json({
      totalDocuments: Number(docCount.count),
      totalQueries: Number(queryCount.count),
      totalComparisons: Number(comparisonCount.count),
      
      claudeWinRate: Math.round((claudeWins / totalComparisons) * 100),
      openaiWinRate: Math.round((openaiWins / totalComparisons) * 100),
      tieRate: Math.round((ties / totalComparisons) * 100),
      
      claudeThumbsUpRate: claudeFeedback.length 
        ? Math.round((claudeThumbsUp / claudeFeedback.length) * 100) 
        : 0,
      openaiThumbsUpRate: openaiFeedback.length 
        ? Math.round((openaiThumbsUp / openaiFeedback.length) * 100) 
        : 0,
      
      claudeAvgLatencyMs: Math.round(avgClaudeLatency),
      openaiAvgLatencyMs: Math.round(avgOpenaiLatency),
      
      // Enhanced metrics
      claudeAvgLength,
      openaiAvgLength,
      claudeAgreementRate,
      openaiAgreementRate,
      winRateByType: {
        summaries: {
          claude: Math.round((summaryClaudeWins / summaryTotal) * 100),
          openai: Math.round((summaryOpenaiWins / summaryTotal) * 100),
          tie: Math.round((summaryTies / summaryTotal) * 100)
        },
        queries: {
          claude: Math.round((queryClaudeWins / queryTotal) * 100),
          openai: Math.round((queryOpenaiWins / queryTotal) * 100),
          tie: Math.round((queryTies / queryTotal) * 100)
        }
      },
      latencyDistribution: {
        claude: {
          min: sortedClaudeLatencies.length > 0 ? sortedClaudeLatencies[0] : 0,
          max: sortedClaudeLatencies.length > 0 ? sortedClaudeLatencies[sortedClaudeLatencies.length - 1] : 0,
          median: getPercentile(sortedClaudeLatencies, 50),
          p95: getPercentile(sortedClaudeLatencies, 95)
        },
        openai: {
          min: sortedOpenaiLatencies.length > 0 ? sortedOpenaiLatencies[0] : 0,
          max: sortedOpenaiLatencies.length > 0 ? sortedOpenaiLatencies[sortedOpenaiLatencies.length - 1] : 0,
          median: getPercentile(sortedOpenaiLatencies, 50),
          p95: getPercentile(sortedOpenaiLatencies, 95)
        }
      },
      
      recentComparisons
    });
    
    // Ensure no caching - always return fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
    
  } catch (error) {
    logger.error('Eval stats fetch failed', 'EVALS', error);
    return NextResponse.json({ error: 'Failed to get eval stats' }, { status: 500 });
  }
}

