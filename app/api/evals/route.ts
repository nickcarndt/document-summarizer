import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, queries, summaries, feedback, comparisons } from '@/db/schema';
import { sql, desc } from 'drizzle-orm';

export async function GET() {
  try {
    // Total counts
    const [docCount] = await db.select({ count: sql<number>`count(*)` }).from(documents);
    const [queryCount] = await db.select({ count: sql<number>`count(*)` }).from(queries);
    const [comparisonCount] = await db.select({ count: sql<number>`count(*)` }).from(comparisons);
    
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
    
    // Average latencies
    const allQueries = await db.select().from(queries);
    const claudeLatencies = allQueries.map(q => q.claudeLatencyMs);
    const openaiLatencies = allQueries.map(q => q.openaiLatencyMs);
    
    const avgClaudeLatency = claudeLatencies.length 
      ? claudeLatencies.reduce((a, b) => a + b, 0) / claudeLatencies.length 
      : 0;
    const avgOpenaiLatency = openaiLatencies.length 
      ? openaiLatencies.reduce((a, b) => a + b, 0) / openaiLatencies.length 
      : 0;
    
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
    console.error('[EVALS] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to get eval stats' }, { status: 500 });
  }
}

