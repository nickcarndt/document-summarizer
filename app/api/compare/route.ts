import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { comparisons } from '@/db/schema';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { referenceType, referenceId, winner } = await request.json();
    
    if (!referenceType || !referenceId || !winner) {
      logger.warn('Compare request missing required fields', 'COMPARE');
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    
    if (!['summary', 'query'].includes(referenceType)) {
      logger.warn('Invalid referenceType', 'COMPARE', { referenceType });
      return NextResponse.json({ error: 'referenceType must be "summary" or "query"' }, { status: 400 });
    }
    
    if (!['claude', 'openai', 'tie'].includes(winner)) {
      logger.warn('Invalid winner', 'COMPARE', { winner });
      return NextResponse.json({ error: 'winner must be "claude", "openai", or "tie"' }, { status: 400 });
    }
    
    logger.info('Saving comparison', 'COMPARE', { referenceType, winner });
    
    const [record] = await db.insert(comparisons).values({
      referenceType,
      referenceId,
      winner
    }).returning();
    
    logger.info('Comparison saved', 'COMPARE', { comparisonId: record.id });
    
    return NextResponse.json({ id: record.id });
    
  } catch (error) {
    logger.error('Comparison save failed', 'COMPARE', error);
    return NextResponse.json({ error: 'Failed to save comparison' }, { status: 500 });
  }
}

