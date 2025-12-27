import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, queries, summaries, feedback, comparisons } from '@/db/schema';
import { sql, desc, eq, gte, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Parse date range if provided
    let dateFilter: { start?: Date; end?: Date } = {};
    if (startDate) {
      dateFilter.start = new Date(startDate);
    }
    if (endDate) {
      dateFilter.end = new Date(endDate);
      // Set to end of day
      dateFilter.end.setHours(23, 59, 59, 999);
    }
    
    logger.info('Fetching eval stats', 'EVALS', { dateFilter });
    
    // Get all data first
    const allDocs = await db.select().from(documents);
    const allQueries = await db.select().from(queries);
    const allComparisons = await db.select().from(comparisons);
    const allFeedback = await db.select().from(feedback);
    const allSummaries = await db.select().from(summaries);
    
    // Helper function to filter by date
    const filterByDate = <T extends { createdAt: Date | string }>(items: T[]): T[] => {
      if (!dateFilter.start && !dateFilter.end) return items;
      return items.filter(item => {
        const itemDate = new Date(item.createdAt);
        if (dateFilter.start && itemDate < dateFilter.start) return false;
        if (dateFilter.end && itemDate > dateFilter.end) return false;
        return true;
      });
    };
    
    // Apply date filter if provided
    const filteredDocs = filterByDate(allDocs);
    const filteredQueries = filterByDate(allQueries);
    const filteredComparisons = filterByDate(allComparisons);
    const feedbackResults = filterByDate(allFeedback);
    const summariesFiltered = filterByDate(allSummaries);
    
    // Total counts (from filtered data)
    const docCount = { count: BigInt(filteredDocs.length) };
    const queryCount = { count: BigInt(filteredQueries.length) };
    const comparisonCount = { count: BigInt(filteredComparisons.length) };
    
    logger.debug('Counts retrieved', 'EVALS', { 
      documents: Number(docCount.count),
      queries: Number(queryCount.count),
      comparisons: Number(comparisonCount.count)
    });
    
    // Win rates (use filtered comparisons)
    const comparisonResults = filteredComparisons;
    const claudeWins = comparisonResults.filter(c => c.winner === 'claude').length;
    const openaiWins = comparisonResults.filter(c => c.winner === 'openai').length;
    const ties = comparisonResults.filter(c => c.winner === 'tie').length;
    const totalComparisons = comparisonResults.length || 1; // Avoid division by zero
    
    // Win counts for display
    const winCounts = {
      claude: claudeWins,
      openai: openaiWins,
      tie: ties
    };
    
    // Thumbs up rates (already filtered above)
    const claudeFeedback = feedbackResults.filter(f => f.model === 'claude');
    const openaiFeedback = feedbackResults.filter(f => f.model === 'openai');
    
    const claudeThumbsUp = claudeFeedback.filter(f => f.rating === 'up').length;
    const openaiThumbsUp = openaiFeedback.filter(f => f.rating === 'up').length;
    
    // Average latencies - Get from BOTH summaries and queries (already filtered above)
    const allSummaries = summariesFiltered;
    const allQueries = filteredQueries;
    
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
    
    // Recent comparisons with question preview for queries (already filtered by date above)
    const recentComparisonsRaw = comparisonResults
      .map(c => ({
        id: c.id,
        referenceType: c.referenceType,
        referenceId: c.referenceId,
        winner: c.winner,
        createdAt: c.createdAt
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
    
    // Fetch question text for query comparisons
    const recentComparisons = await Promise.all(
      recentComparisonsRaw.map(async (comp) => {
        if (comp.referenceType === 'query') {
          const [query] = await db
            .select({ question: queries.question })
            .from(queries)
            .where(eq(queries.id, comp.referenceId))
            .limit(1);
          return {
            ...comp,
            questionPreview: query?.question ? query.question.substring(0, 50) + (query.question.length > 50 ? '...' : '') : null
          };
        }
        // For summaries, get document filename
        if (comp.referenceType === 'summary') {
          const [summary] = await db
            .select({ documentId: summaries.documentId })
            .from(summaries)
            .where(eq(summaries.id, comp.referenceId))
            .limit(1);
          if (summary) {
            const [doc] = await db
              .select({ filename: documents.filename })
              .from(documents)
              .where(eq(documents.id, summary.documentId))
              .limit(1);
            return {
              ...comp,
              questionPreview: doc?.filename || null
            };
          }
        }
        return { ...comp, questionPreview: null };
      })
    );
    
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
    
    // 7c. Win Rate by Type (Summary vs Q&A) - already filtered by date above
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
    
    // 10a. Cost Tracking
    // Pricing (per 1M tokens)
    const CLAUDE_SONNET_INPUT = 0.003;  // $3 per 1M input tokens
    const CLAUDE_SONNET_OUTPUT = 0.015; // $15 per 1M output tokens
    const GPT4O_MINI_INPUT = 0.00015;   // $0.15 per 1M input
    const GPT4O_MINI_OUTPUT = 0.0006;   // $0.60 per 1M output
    
    // Calculate costs from summaries (we have token data)
    const claudeSummaryCost = allSummaries
      .filter(s => s.model === 'claude')
      .reduce((total, s) => {
        const inputCost = (s.inputTokens || 0) * (CLAUDE_SONNET_INPUT / 1000000);
        const outputCost = (s.outputTokens || 0) * (CLAUDE_SONNET_OUTPUT / 1000000);
        return total + inputCost + outputCost;
      }, 0);
    
    const openaiSummaryCost = allSummaries
      .filter(s => s.model === 'openai')
      .reduce((total, s) => {
        const inputCost = (s.inputTokens || 0) * (GPT4O_MINI_INPUT / 1000000);
        const outputCost = (s.outputTokens || 0) * (GPT4O_MINI_OUTPUT / 1000000);
        return total + inputCost + outputCost;
      }, 0);
    
    // Note: Queries don't have token data, so we can't calculate their cost accurately
    // We'll only show summary costs for now
    const totalClaudeCost = claudeSummaryCost;
    const totalOpenaiCost = openaiSummaryCost;
    
    const response = NextResponse.json({
      totalDocuments: Number(docCount.count),
      totalQueries: Number(queryCount.count),
      totalComparisons: Number(comparisonCount.count),
      
      claudeWinRate: Math.round((claudeWins / totalComparisons) * 100),
      openaiWinRate: Math.round((openaiWins / totalComparisons) * 100),
      tieRate: Math.round((ties / totalComparisons) * 100),
      winCounts,
      
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
          tie: Math.round((summaryTies / summaryTotal) * 100),
          total: summaryComparisons.length
        },
        queries: {
          claude: Math.round((queryClaudeWins / queryTotal) * 100),
          openai: Math.round((queryOpenaiWins / queryTotal) * 100),
          tie: Math.round((queryTies / queryTotal) * 100),
          total: queryComparisons.length
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
      
      costs: {
        claude: Math.round(totalClaudeCost * 100) / 100, // Round to 2 decimal places
        openai: Math.round(totalOpenaiCost * 100) / 100
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

