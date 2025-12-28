import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { comparisons } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    logger.debug('Compare request received', 'COMPARE', { body });
    
    const { referenceType, referenceId, winner } = body;
    
    logger.debug('Compare request parsed', 'COMPARE', { 
      referenceType, 
      referenceId, 
      winner, 
      winnerType: typeof winner 
    });
    
    if (!referenceType || !referenceId || !winner) {
      logger.warn('Compare request missing required fields', 'COMPARE', { referenceType, referenceId, winner });
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    
    if (!['summary', 'query'].includes(referenceType)) {
      logger.warn('Invalid referenceType', 'COMPARE', { referenceType });
      return NextResponse.json({ error: 'referenceType must be "summary" or "query"' }, { status: 400 });
    }
    
    if (!['claude', 'openai', 'tie'].includes(winner)) {
      logger.warn('Invalid winner', 'COMPARE', { winner, winnerType: typeof winner });
      return NextResponse.json({ error: 'winner must be "claude", "openai", or "tie"' }, { status: 400 });
    }
    
    logger.info('Saving comparison', 'COMPARE', { referenceType, referenceId, winner });
    
    // Check if comparison already exists for this reference
    const existing = await db
      .select()
      .from(comparisons)
      .where(
        and(
          eq(comparisons.referenceType, referenceType),
          eq(comparisons.referenceId, referenceId)
        )
      )
      .limit(1);
    
    let record;
    if (existing.length > 0) {
      // Update existing comparison instead of creating duplicate
      logger.info('Updating existing comparison', 'COMPARE', { comparisonId: existing[0].id });
      const [updated] = await db
        .update(comparisons)
        .set({ 
          winner,
          createdAt: new Date()
        })
        .where(eq(comparisons.id, existing[0].id))
        .returning();
      record = updated;
    } else {
      // Insert new comparison
      const [inserted] = await db.insert(comparisons).values({
        referenceType,
        referenceId,
        winner
      }).returning();
      record = inserted;
    }
    
    logger.info('Comparison saved', 'COMPARE', { 
      comparisonId: record.id, 
      winner: record.winner,
      updated: existing.length > 0 
    });
    
    logger.debug('Comparison record details', 'COMPARE', { 
      id: record.id,
      referenceType: record.referenceType,
      referenceId: record.referenceId,
      winner: record.winner,
      createdAt: record.createdAt
    });
    
    return NextResponse.json({ id: record.id, updated: existing.length > 0 });
    
  } catch (error) {
    logger.error('Comparison save failed', 'COMPARE', error);
    return NextResponse.json({ error: 'Failed to save comparison' }, { status: 500 });
  }
}

