import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, summaries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateWithClaude } from '@/lib/anthropic';
import { generateWithOpenAI } from '@/lib/openai';
import { logger } from '@/lib/logger';

const SYSTEM_PROMPT = `You are a document summarizer. Provide a concise summary of the document followed by key bullet points. Format your response as:

**Summary**
[2-3 paragraph summary]

**Key Points**
• [point 1]
• [point 2]
• [point 3]
...`;

const MAX_INPUT_CHARS = 100000; // Truncate very long documents

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json();
    
    if (!documentId) {
      logger.warn('Summarize request missing documentId', 'SUMMARIZE');
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }
    
    logger.info('Starting summarization', 'SUMMARIZE', { documentId });
    
    // Check if summaries already exist
    const existingSummaries = await db
      .select()
      .from(summaries)
      .where(eq(summaries.documentId, documentId));
    
    const claudeSummary = existingSummaries.find(s => s.model === 'claude');
    const openaiSummary = existingSummaries.find(s => s.model === 'openai');
    
    if (claudeSummary && openaiSummary) {
      // Summaries already exist - return them without regenerating
      logger.info('Summaries already exist, returning existing', 'SUMMARIZE', { documentId });
      return NextResponse.json({
        claude: {
          id: claudeSummary.id,
          content: claudeSummary.content,
          latencyMs: claudeSummary.latencyMs
        },
        openai: {
          id: openaiSummary.id,
          content: openaiSummary.content,
          latencyMs: openaiSummary.latencyMs
        }
      });
    }
    
    // Get document
    const [document] = await db.select().from(documents).where(eq(documents.id, documentId));
    
    if (!document) {
      logger.warn('Document not found for summarization', 'SUMMARIZE', { documentId });
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    const textToSummarize = document.textContent.slice(0, MAX_INPUT_CHARS);
    const userPrompt = `Please summarize this document:\n\n${textToSummarize}`;
    
    logger.debug('Calling LLMs in parallel', 'SUMMARIZE', { 
      inputChars: textToSummarize.length,
      truncated: document.textContent.length > MAX_INPUT_CHARS 
    });
    
    // Call both models in parallel
    const startTime = Date.now();
    const [claudeResult, openaiResult] = await Promise.all([
      generateWithClaude(SYSTEM_PROMPT, userPrompt),
      generateWithOpenAI(SYSTEM_PROMPT, userPrompt)
    ]);
    const totalTime = Date.now() - startTime;
    
    logger.info('Summaries generated', 'SUMMARIZE', {
      claudeLatency: claudeResult.latencyMs,
      openaiLatency: openaiResult.latencyMs,
      totalTime,
      claudeTokens: { input: claudeResult.inputTokens, output: claudeResult.outputTokens },
      openaiTokens: { input: openaiResult.inputTokens, output: openaiResult.outputTokens }
    });
    
    // Store summaries
    const [newClaudeSummary] = await db.insert(summaries).values({
      documentId,
      model: 'claude',
      content: claudeResult.content,
      latencyMs: claudeResult.latencyMs,
      inputTokens: claudeResult.inputTokens,
      outputTokens: claudeResult.outputTokens
    }).returning();
    
    const [newOpenaiSummary] = await db.insert(summaries).values({
      documentId,
      model: 'openai',
      content: openaiResult.content,
      latencyMs: openaiResult.latencyMs,
      inputTokens: openaiResult.inputTokens,
      outputTokens: openaiResult.outputTokens
    }).returning();
    
    logger.info('Summaries saved to database', 'SUMMARIZE', { documentId });
    
    return NextResponse.json({
      claude: {
        id: newClaudeSummary.id,
        content: claudeResult.content,
        latencyMs: claudeResult.latencyMs
      },
      openai: {
        id: newOpenaiSummary.id,
        content: openaiResult.content,
        latencyMs: openaiResult.latencyMs
      }
    });
    
  } catch (error) {
    logger.error('Summarization failed', 'SUMMARIZE', error);
    return NextResponse.json({ error: 'Failed to generate summaries' }, { status: 500 });
  }
}

