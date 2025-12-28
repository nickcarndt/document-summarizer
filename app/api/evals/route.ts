import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, queries, summaries, feedback, comparisons } from '@/db/schema';
import { sql, desc, eq, gte, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// Mark route as dynamic since we use searchParams
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[EVALS] === Starting eval data fetch ===');
    
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
    console.log('[EVALS] Documents count:', allDocs.length);
    
    const allQueries = await db.select().from(queries);
    console.log('[EVALS] Raw queries from DB:', allQueries.length);
    console.log('[EVALS] Queries count:', allQueries.length);
    if (allQueries.length > 0) {
      console.log('[EVALS] Query dates:', allQueries.map(q => ({
        id: q.id.substring(0, 8),
        date: new Date(q.createdAt).toISOString()
      })));
    } else {
      console.log('[EVALS] WARNING: No queries found in database!');
    }
    
    const allComparisons = await db.select().from(comparisons);
    console.log('[EVALS] Comparisons count:', allComparisons.length);
    console.log('[EVALS] Comparisons breakdown:', {
      claude: allComparisons.filter(c => c.winner === 'claude').length,
      openai: allComparisons.filter(c => c.winner === 'openai').length,
      tie: allComparisons.filter(c => c.winner === 'tie').length,
    });
    console.log('[EVALS] Comparison dates:', allComparisons.map(c => ({
      id: c.id.substring(0, 8),
      winner: c.winner,
      date: new Date(c.createdAt).toISOString()
    })));
    
    const allFeedback = await db.select().from(feedback);
    const allSummaries = await db.select().from(summaries);
    
    // Debug logging
    logger.debug('Total queries in DB', 'EVALS', { totalQueries: allQueries.length });
    
    // Helper function to filter by date
    const filterByDate = <T extends { createdAt: Date | string }>(items: T[]): T[] => {
      if (!dateFilter.start && !dateFilter.end) {
        console.log('[EVALS] No date filter - returning all items');
        return items;
      }
      console.log('[EVALS] Applying date filter:', {
        start: dateFilter.start?.toISOString(),
        end: dateFilter.end?.toISOString(),
        itemCount: items.length
      });
      const filtered = items.filter(item => {
        const itemDate = new Date(item.createdAt);
        // Include items on or after start date
        if (dateFilter.start && itemDate < dateFilter.start) {
          console.log('[EVALS] Filtering out item before start date:', {
            itemDate: itemDate.toISOString(),
            startDate: dateFilter.start.toISOString()
          });
          return false;
        }
        // Include items on or before end date
        if (dateFilter.end && itemDate > dateFilter.end) {
          console.log('[EVALS] Filtering out item after end date:', {
            itemDate: itemDate.toISOString(),
            endDate: dateFilter.end.toISOString()
          });
          return false;
        }
        return true;
      });
      console.log('[EVALS] Date filter result:', {
        original: items.length,
        filtered: filtered.length,
        removed: items.length - filtered.length
      });
      return filtered;
    };
    
    // Apply date filter if provided
    // TEMPORARILY DISABLED FOR DEBUGGING - Check if date filter is excluding recent data
    console.log('[EVALS] Date filter status:', { 
      hasStartDate: !!dateFilter.start, 
      hasEndDate: !!dateFilter.end,
      startDate: dateFilter.start?.toISOString(),
      endDate: dateFilter.end?.toISOString()
    });
    
    // Apply date filter - RE-ENABLED with better logging
    const filteredDocs = filterByDate(allDocs);
    const filteredQueries = filterByDate(allQueries);
    const filteredComparisons = filterByDate(allComparisons);
    const feedbackResults = filterByDate(allFeedback);
    const summariesFiltered = filterByDate(allSummaries);
    
    console.log('[EVALS] After filtering:', {
      docs: { all: allDocs.length, filtered: filteredDocs.length },
      queries: { all: allQueries.length, filtered: filteredQueries.length },
      comparisons: { all: allComparisons.length, filtered: filteredComparisons.length },
      feedback: { all: allFeedback.length, filtered: feedbackResults.length },
      summaries: { all: allSummaries.length, filtered: summariesFiltered.length }
    });
    
    // Total counts (from filtered data)
    console.log('[EVALS] Final counts before response:', {
      allQueries: allQueries.length,
      filteredQueries: filteredQueries.length,
      allComparisons: allComparisons.length,
      filteredComparisons: filteredComparisons.length
    });
    
    const docCount = { count: BigInt(filteredDocs.length) };
    const queryCount = { count: BigInt(filteredQueries.length) };
    const comparisonCount = { count: BigInt(filteredComparisons.length) };
    
    console.log('[EVALS] Query count calculation:', {
      allQueriesFromDB: allQueries.length,
      filteredQueriesAfterDateFilter: filteredQueries.length,
      queryCountValue: Number(queryCount.count),
      hasDateFilter: !!(dateFilter.start || dateFilter.end)
    });
    
    logger.debug('Counts retrieved', 'EVALS', { 
      documents: Number(docCount.count),
      queries: Number(queryCount.count),
      comparisons: Number(comparisonCount.count),
      allQueriesCount: allQueries.length,
      filteredQueriesCount: filteredQueries.length
    });
    
    // Win rates (use filtered comparisons)
    const comparisonResults = filteredComparisons;
    const claudeWins = comparisonResults.filter(c => c.winner === 'claude').length;
    const openaiWins = comparisonResults.filter(c => c.winner === 'openai').length;
    const ties = comparisonResults.filter(c => c.winner === 'tie').length;
    const totalComparisons = comparisonResults.length || 1; // Avoid division by zero
    
    console.log('[EVALS] Win calculation:', { 
      claudeWins, 
      openaiWins, 
      tieCount: ties, 
      total: totalComparisons,
      filteredCount: comparisonResults.length,
      allCount: allComparisons.length
    });
    
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
    // Use filtered data directly
    const claudeSummaryLatencies = summariesFiltered
      .filter(s => s.model === 'claude')
      .map(s => s.latencyMs);
    const openaiSummaryLatencies = summariesFiltered
      .filter(s => s.model === 'openai')
      .map(s => s.latencyMs);
    
    // Query latencies
    const claudeQueryLatencies = filteredQueries.map(q => q.claudeLatencyMs);
    const openaiQueryLatencies = filteredQueries.map(q => q.openaiLatencyMs);
    
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
      summariesCount: summariesFiltered.length,
      queriesCount: filteredQueries.length,
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
    const claudeSummaryLengths = summariesFiltered
      .filter(s => s.model === 'claude')
      .map(s => s.content.length);
    const openaiSummaryLengths = summariesFiltered
      .filter(s => s.model === 'openai')
      .map(s => s.content.length);
    const claudeQueryLengths = filteredQueries.map(q => q.claudeResponse.length);
    const openaiQueryLengths = filteredQueries.map(q => q.openaiResponse.length);
    
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
    // Pricing constants (per token, not per 1M)
    const CLAUDE_INPUT_COST = 3.00 / 1_000_000;   // $3 per 1M input tokens
    const CLAUDE_OUTPUT_COST = 15.00 / 1_000_000;  // $15 per 1M output tokens
    const OPENAI_INPUT_COST = 0.15 / 1_000_000;   // $0.15 per 1M input tokens  
    const OPENAI_OUTPUT_COST = 0.60 / 1_000_000;  // $0.60 per 1M output tokens
    
    // Debug logging
    if (summariesFiltered.length > 0) {
      logger.debug('Sample summary tokens', 'EVALS', {
        firstSummary: {
          model: summariesFiltered[0].model,
          inputTokens: summariesFiltered[0].inputTokens,
          outputTokens: summariesFiltered[0].outputTokens
        }
      });
    }
    
    // Calculate costs from summaries (which have token data)
    const claudeSummaries = summariesFiltered.filter(s => s.model === 'claude');
    const openaiSummaries = summariesFiltered.filter(s => s.model === 'openai');
    
    const claudeTotalInputTokens = claudeSummaries.reduce((acc, s) => acc + (s.inputTokens || 0), 0);
    const claudeTotalOutputTokens = claudeSummaries.reduce((acc, s) => acc + (s.outputTokens || 0), 0);
    const claudeCost = (claudeTotalInputTokens * CLAUDE_INPUT_COST) + (claudeTotalOutputTokens * CLAUDE_OUTPUT_COST);
    
    const openaiTotalInputTokens = openaiSummaries.reduce((acc, s) => acc + (s.inputTokens || 0), 0);
    const openaiTotalOutputTokens = openaiSummaries.reduce((acc, s) => acc + (s.outputTokens || 0), 0);
    const openaiCost = (openaiTotalInputTokens * OPENAI_INPUT_COST) + (openaiTotalOutputTokens * OPENAI_OUTPUT_COST);
    
    logger.debug('Cost calculation', 'EVALS', {
      claude: {
        inputTokens: claudeTotalInputTokens,
        outputTokens: claudeTotalOutputTokens,
        cost: claudeCost
      },
      openai: {
        inputTokens: openaiTotalInputTokens,
        outputTokens: openaiTotalOutputTokens,
        cost: openaiCost
      }
    });
    
    const data = {
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
        claude: parseFloat(claudeCost.toFixed(2)),
        openai: parseFloat(openaiCost.toFixed(2))
      },
      
      recentComparisons
    };
    
    console.log('[EVALS] Returning:', {
      totalDocuments: data.totalDocuments,
      totalQueries: data.totalQueries,
      totalComparisons: data.totalComparisons,
      claudeWins: winCounts.claude,
      openaiWins: winCounts.openai,
      ties: winCounts.tie,
      claudeWinRate: data.claudeWinRate,
      openaiWinRate: data.openaiWinRate,
      tieRate: data.tieRate
    });
    
    // Return with no-cache headers to ensure fresh data
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
      }
    });
    
  } catch (error) {
    logger.error('Eval stats fetch failed', 'EVALS', error);
    return NextResponse.json({ error: 'Failed to get eval stats' }, { status: 500 });
  }
}

