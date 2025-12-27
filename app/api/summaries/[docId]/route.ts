import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { summaries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  try {
    const { docId } = params;
    
    logger.debug('Fetching summaries', 'SUMMARIES', { docId });
    
    // Fetch existing summaries for this document
    const existingSummaries = await db
      .select()
      .from(summaries)
      .where(eq(summaries.documentId, docId));
    
    const claudeSummary = existingSummaries.find(s => s.model === 'claude');
    const openaiSummary = existingSummaries.find(s => s.model === 'openai');
    
    // If both summaries exist, return them
    if (claudeSummary && openaiSummary) {
      logger.info('Summaries found', 'SUMMARIES', { docId });
      return NextResponse.json({
        claude: {
          id: claudeSummary.id,
          content: claudeSummary.content,
          latencyMs: claudeSummary.latencyMs
        },
        openai: {
          id: openaiSummary.id,
          content: openaiSummary.content,
          latencyMs: openaiSummary.latencyMs
        }
      });
    }
    
    // No summaries found
    logger.debug('No summaries found', 'SUMMARIES', { docId });
    return NextResponse.json({
      claude: null,
      openai: null
    });
    
  } catch (error) {
    logger.error('Failed to fetch summaries', 'SUMMARIES', error);
    return NextResponse.json({ error: 'Failed to fetch summaries' }, { status: 500 });
  }
}

