import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chunks, queries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateWithClaude } from '@/lib/anthropic';
import { generateWithOpenAI } from '@/lib/openai';
import { generateEmbedding } from '@/lib/embeddings';
import { retrieveTopK } from '@/lib/retrieval';

const SYSTEM_PROMPT = `You are a helpful assistant answering questions about a document. Use the provided context to answer the question accurately. If the context doesn't contain enough information to answer, say so.`;

export async function POST(request: NextRequest) {
  try {
    const { documentId, question } = await request.json();
    
    if (!documentId || !question) {
      return NextResponse.json({ error: 'documentId and question are required' }, { status: 400 });
    }
    
    // Get chunks for this document
    const documentChunks = await db.select().from(chunks).where(eq(chunks.documentId, documentId));
    
    if (documentChunks.length === 0) {
      return NextResponse.json({ error: 'Document has not been embedded yet' }, { status: 400 });
    }
    
    // Parse embeddings and prepare for retrieval
    const chunksWithEmbeddings = documentChunks.map(c => ({
      id: c.id,
      text: c.text,
      embedding: JSON.parse(c.embedding || '[]') as number[]
    }));
    
    // Embed the question
    const questionEmbedding = await generateEmbedding(question);
    
    // Retrieve top 5 relevant chunks
    const relevantChunks = retrieveTopK(questionEmbedding, chunksWithEmbeddings, 5);
    
    // Build context from retrieved chunks
    const context = relevantChunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');
    
    const userPrompt = `Context from the document:
${context}

Question: ${question}

Please answer based on the context provided.`;
    
    // Call both models in parallel
    const [claudeResult, openaiResult] = await Promise.all([
      generateWithClaude(SYSTEM_PROMPT, userPrompt),
      generateWithOpenAI(SYSTEM_PROMPT, userPrompt)
    ]);
    
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
    console.error('Query error:', error);
    return NextResponse.json({ error: 'Failed to process query' }, { status: 500 });
  }
}

