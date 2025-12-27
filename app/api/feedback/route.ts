import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { feedback } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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
    
    // Check if feedback already exists for this reference + model combination
    const existing = await db
      .select()
      .from(feedback)
      .where(
        and(
          eq(feedback.referenceType, referenceType),
          eq(feedback.referenceId, referenceId),
          eq(feedback.model, model)
        )
      )
      .limit(1);
    
    let record;
    if (existing.length > 0) {
      // Update existing feedback instead of creating duplicate
      logger.info('Updating existing feedback', 'FEEDBACK', { feedbackId: existing[0].id });
      const [updated] = await db
        .update(feedback)
        .set({ 
          rating,
          createdAt: new Date()
        })
        .where(eq(feedback.id, existing[0].id))
        .returning();
      record = updated;
    } else {
      // Insert new feedback
      const [inserted] = await db.insert(feedback).values({
        referenceType,
        referenceId,
        model,
        rating
      }).returning();
      record = inserted;
    }
    
    logger.info('Feedback saved', 'FEEDBACK', { feedbackId: record.id, updated: existing.length > 0 });
    
    return NextResponse.json({ id: record.id, updated: existing.length > 0 });
    
  } catch (error) {
    logger.error('Feedback save failed', 'FEEDBACK', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}

