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
    
    return NextResponse.json({
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
      
      recentComparisons
    });
    
  } catch (error) {
    logger.error('Eval stats fetch failed', 'EVALS', error);
    return NextResponse.json({ error: 'Failed to get eval stats' }, { status: 500 });
  }
}

