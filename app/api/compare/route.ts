import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { comparisons } from '@/db/schema';

export async function POST(request: NextRequest) {
  try {
    const { referenceType, referenceId, winner } = await request.json();
    
    if (!referenceType || !referenceId || !winner) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    
    if (!['summary', 'query'].includes(referenceType)) {
      return NextResponse.json({ error: 'referenceType must be "summary" or "query"' }, { status: 400 });
    }
    
    if (!['claude', 'openai', 'tie'].includes(winner)) {
      return NextResponse.json({ error: 'winner must be "claude", "openai", or "tie"' }, { status: 400 });
    }
    
    const [record] = await db.insert(comparisons).values({
      referenceType,
      referenceId,
      winner
    }).returning();
    
    return NextResponse.json({ id: record.id });
    
  } catch (error) {
    console.error('[COMPARE] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to save comparison' }, { status: 500 });
  }
}

