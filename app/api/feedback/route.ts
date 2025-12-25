import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { feedback } from '@/db/schema';

export async function POST(request: NextRequest) {
  try {
    const { referenceType, referenceId, model, rating } = await request.json();
    
    if (!referenceType || !referenceId || !model || !rating) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    
    if (!['summary', 'query'].includes(referenceType)) {
      return NextResponse.json({ error: 'referenceType must be "summary" or "query"' }, { status: 400 });
    }
    
    if (!['claude', 'openai'].includes(model)) {
      return NextResponse.json({ error: 'model must be "claude" or "openai"' }, { status: 400 });
    }
    
    if (!['up', 'down'].includes(rating)) {
      return NextResponse.json({ error: 'rating must be "up" or "down"' }, { status: 400 });
    }
    
    const [record] = await db.insert(feedback).values({
      referenceType,
      referenceId,
      model,
      rating
    }).returning();
    
    return NextResponse.json({ id: record.id });
    
  } catch (error) {
    console.error('[FEEDBACK] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}

