import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  try {
    const { docId } = params;
    
    logger.debug('Fetching document', 'DOCUMENT', { docId });
    
    const [document] = await db.select().from(documents).where(eq(documents.id, docId));
    
    if (!document) {
      logger.warn('Document not found', 'DOCUMENT', { docId });
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    logger.info('Document fetched', 'DOCUMENT', { docId, filename: document.filename });
    
    return NextResponse.json({
      id: document.id,
      filename: document.filename,
      charCount: document.charCount,
      chunkCount: document.chunkCount,
      createdAt: document.createdAt
    });
    
  } catch (error) {
    logger.error('Failed to fetch document', 'DOCUMENT', error);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}

