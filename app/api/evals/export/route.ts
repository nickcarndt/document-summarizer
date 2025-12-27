import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, queries, summaries, feedback, comparisons } from '@/db/schema';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    logger.info('Exporting eval data to JSON', 'EVALS_EXPORT');
    
    // Fetch all data
    const allDocuments = await db.select().from(documents);
    const allQueries = await db.select().from(queries);
    const allSummaries = await db.select().from(summaries);
    const allFeedback = await db.select().from(feedback);
    const allComparisons = await db.select().from(comparisons);
    
    // Build JSON structure
    const data = {
      exportedAt: new Date().toISOString(),
      documents: allDocuments.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        charCount: doc.charCount,
        chunkCount: doc.chunkCount,
        createdAt: doc.createdAt.toISOString()
      })),
      summaries: allSummaries.map(summary => ({
        id: summary.id,
        documentId: summary.documentId,
        model: summary.model,
        contentLength: summary.content.length,
        latencyMs: summary.latencyMs,
        inputTokens: summary.inputTokens,
        outputTokens: summary.outputTokens,
        createdAt: summary.createdAt.toISOString()
      })),
      queries: allQueries.map(query => ({
        id: query.id,
        documentId: query.documentId,
        question: query.question,
        claudeResponseLength: query.claudeResponse.length,
        claudeLatencyMs: query.claudeLatencyMs,
        openaiResponseLength: query.openaiResponse.length,
        openaiLatencyMs: query.openaiLatencyMs,
        createdAt: query.createdAt.toISOString()
      })),
      feedback: allFeedback.map(fb => ({
        id: fb.id,
        referenceType: fb.referenceType,
        referenceId: fb.referenceId,
        model: fb.model,
        rating: fb.rating,
        createdAt: fb.createdAt.toISOString()
      })),
      comparisons: allComparisons.map(comp => ({
        id: comp.id,
        referenceType: comp.referenceType,
        referenceId: comp.referenceId,
        winner: comp.winner,
        createdAt: comp.createdAt.toISOString()
      }))
    };
    
    // Return JSON file
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="eval-data-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
    
  } catch (error) {
    logger.error('Eval data export failed', 'EVALS_EXPORT', error);
    return NextResponse.json({ error: 'Failed to export eval data' }, { status: 500 });
  }
}

