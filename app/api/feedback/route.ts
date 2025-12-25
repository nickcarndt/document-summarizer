import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { feedback } from '@/db/schema';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { referenceType, referenceId, model, rating } = await request.json();
    
    if (!referenceType || !referenceId || !model || !rating) {
      logger.warn('Feedback request missing required fields', 'FEEDBACK');
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    
    if (!['summary', 'query'].includes(referenceType)) {
      logger.warn('Invalid referenceType', 'FEEDBACK', { referenceType });
      return NextResponse.json({ error: 'referenceType must be "summary" or "query"' }, { status: 400 });
    }
    
    if (!['claude', 'openai'].includes(model)) {
      logger.warn('Invalid model', 'FEEDBACK', { model });
      return NextResponse.json({ error: 'model must be "claude" or "openai"' }, { status: 400 });
    }
    
    if (!['up', 'down'].includes(rating)) {
      logger.warn('Invalid rating', 'FEEDBACK', { rating });
      return NextResponse.json({ error: 'rating must be "up" or "down"' }, { status: 400 });
    }
    
    logger.info('Saving feedback', 'FEEDBACK', { referenceType, model, rating });
    
    const [record] = await db.insert(feedback).values({
      referenceType,
      referenceId,
      model,
      rating
    }).returning();
    
    logger.info('Feedback saved', 'FEEDBACK', { feedbackId: record.id });
    
    return NextResponse.json({ id: record.id });
    
  } catch (error) {
    logger.error('Feedback save failed', 'FEEDBACK', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}

