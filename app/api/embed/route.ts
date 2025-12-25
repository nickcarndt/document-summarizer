import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, chunks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { chunkText } from '@/lib/chunking';
import { generateEmbeddings } from '@/lib/embeddings';

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json();
    
    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }
    
    // Get document
    const [document] = await db.select().from(documents).where(eq(documents.id, documentId));
    
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    // Chunk the text
    const textChunks = chunkText(document.textContent);
    
    // Generate embeddings in batches
    const chunkTexts = textChunks.map(c => c.text);
    const embeddings = await generateEmbeddings(chunkTexts);
    
    // Insert chunks with embeddings
    const chunkRecords = textChunks.map((chunk, i) => ({
      documentId: documentId,
      chunkIndex: chunk.index,
      text: chunk.text,
      embedding: JSON.stringify(embeddings[i])
    }));
    
    await db.insert(chunks).values(chunkRecords);
    
    // Update document with chunk count
    await db.update(documents)
      .set({ chunkCount: textChunks.length })
      .where(eq(documents.id, documentId));
    
    return NextResponse.json({
      documentId,
      chunkCount: textChunks.length
    });
    
  } catch (error) {
    console.error('[EMBED] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to embed document' }, { status: 500 });
  }
}

