import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, chunks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { chunkText } from '@/lib/chunking';
import { generateEmbeddings } from '@/lib/embeddings';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json();
    
    if (!documentId) {
      logger.warn('Embed request missing documentId', 'EMBED');
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }
    
    logger.info('Starting document embedding', 'EMBED', { documentId });
    
    // Get document
    const [document] = await db.select().from(documents).where(eq(documents.id, documentId));
    
    if (!document) {
      logger.warn('Document not found for embedding', 'EMBED', { documentId });
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    // Chunk the text
    logger.debug('Chunking document text', 'EMBED', { charCount: document.charCount });
    const textChunks = chunkText(document.textContent);
    logger.info('Document chunked', 'EMBED', { chunkCount: textChunks.length });
    
    // Generate embeddings in batches
    logger.debug('Generating embeddings', 'EMBED', { chunkCount: textChunks.length });
    const chunkTexts = textChunks.map(c => c.text);
    const embeddings = await generateEmbeddings(chunkTexts);
    logger.info('Embeddings generated', 'EMBED', { embeddingCount: embeddings.length });
    
    // Insert chunks with embeddings
    const chunkRecords = textChunks.map((chunk, i) => ({
      documentId: documentId,
      chunkIndex: chunk.index,
      text: chunk.text,
      embedding: JSON.stringify(embeddings[i])
    }));
    
    await db.insert(chunks).values(chunkRecords);
    logger.debug('Chunks saved to database', 'EMBED');
    
    // Update document with chunk count
    await db.update(documents)
      .set({ chunkCount: textChunks.length })
      .where(eq(documents.id, documentId));
    
    logger.info('Document embedding completed', 'EMBED', { documentId, chunkCount: textChunks.length });
    
    return NextResponse.json({
      documentId,
      chunkCount: textChunks.length
    });
    
  } catch (error) {
    logger.error('Embedding failed', 'EMBED', error);
    return NextResponse.json({ error: 'Failed to embed document' }, { status: 500 });
  }
}

