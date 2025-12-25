import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chunks, queries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateWithClaude } from '@/lib/anthropic';
import { generateWithOpenAI } from '@/lib/openai';
import { generateEmbedding } from '@/lib/embeddings';
import { retrieveTopK } from '@/lib/retrieval';
import { logger } from '@/lib/logger';

const SYSTEM_PROMPT = `You are a helpful assistant answering questions about a document. Use the provided context to answer the question accurately. If the context doesn't contain enough information to answer, say so.`;

export async function POST(request: NextRequest) {
  try {
    const { documentId, question } = await request.json();
    
    if (!documentId || !question) {
      logger.warn('Query request missing required fields', 'QUERY', { hasDocumentId: !!documentId, hasQuestion: !!question });
      return NextResponse.json({ error: 'documentId and question are required' }, { status: 400 });
    }
    
    logger.info('Processing query', 'QUERY', { documentId, questionLength: question.length });
    
    // Get chunks for this document
    const documentChunks = await db.select().from(chunks).where(eq(chunks.documentId, documentId));
    
    if (documentChunks.length === 0) {
      logger.warn('Document not embedded', 'QUERY', { documentId });
      return NextResponse.json({ error: 'Document has not been embedded yet' }, { status: 400 });
    }
    
    logger.debug('Retrieving relevant chunks', 'QUERY', { totalChunks: documentChunks.length });
    
    // Parse embeddings and prepare for retrieval
    const chunksWithEmbeddings = documentChunks.map(c => ({
      id: c.id,
      text: c.text,
      embedding: JSON.parse(c.embedding || '[]') as number[]
    }));
    
    // Embed the question
    logger.debug('Generating question embedding', 'QUERY');
    const questionEmbedding = await generateEmbedding(question);
    
    // Retrieve top 5 relevant chunks
    const relevantChunks = retrieveTopK(questionEmbedding, chunksWithEmbeddings, 5);
    logger.info('Relevant chunks retrieved', 'QUERY', { 
      chunkCount: relevantChunks.length,
      topScore: relevantChunks[0]?.score 
    });
    
    // Build context from retrieved chunks
    const context = relevantChunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');
    
    const userPrompt = `Context from the document:
${context}

Question: ${question}

Please answer based on the context provided.`;
    
    logger.debug('Calling LLMs in parallel', 'QUERY', { contextLength: context.length });
    
    // Call both models in parallel
    const startTime = Date.now();
    const [claudeResult, openaiResult] = await Promise.all([
      generateWithClaude(SYSTEM_PROMPT, userPrompt),
      generateWithOpenAI(SYSTEM_PROMPT, userPrompt)
    ]);
    const totalTime = Date.now() - startTime;
    
    logger.info('Query responses generated', 'QUERY', {
      claudeLatency: claudeResult.latencyMs,
      openaiLatency: openaiResult.latencyMs,
      totalTime
    });
    
    // Store query and responses
    const [queryRecord] = await db.insert(queries).values({
      documentId,
      question,
      claudeResponse: claudeResult.content,
      claudeLatencyMs: claudeResult.latencyMs,
      openaiResponse: openaiResult.content,
      openaiLatencyMs: openaiResult.latencyMs,
      chunksUsed: relevantChunks.map(c => ({ id: c.id, score: c.score }))
    }).returning();
    
    logger.info('Query saved to database', 'QUERY', { queryId: queryRecord.id });
    
    return NextResponse.json({
      queryId: queryRecord.id,
      claude: {
        content: claudeResult.content,
        latencyMs: claudeResult.latencyMs
      },
      openai: {
        content: openaiResult.content,
        latencyMs: openaiResult.latencyMs
      },
      chunksUsed: relevantChunks.length
    });
    
  } catch (error) {
    logger.error('Query processing failed', 'QUERY', error);
    return NextResponse.json({ error: 'Failed to process query' }, { status: 500 });
  }
}

