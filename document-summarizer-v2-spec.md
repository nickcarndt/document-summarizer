# Document Summarizer V2 - Complete Build Spec

## Project Overview

Build a document summarization and Q&A application that compares Claude and OpenAI responses side-by-side. Users upload PDFs, get summaries from both models, ask questions answered by both models using RAG, and vote on which responses are better. An eval dashboard displays aggregate comparison metrics.

## Tech Stack (LOCKED - DO NOT CHANGE)

- **Framework**: Next.js 14 App Router with TypeScript
- **Styling**: Tailwind CSS
- **Database**: Neon Postgres with Drizzle ORM
- **Vector Search**: pgvector extension (cosine similarity)
- **LLM APIs**: @anthropic-ai/sdk, openai
- **PDF Parsing**: pdf-parse
- **Deployment**: Vercel

## Environment Variables

```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DATABASE_URL=
```

## Database Schema

Create `db/schema.ts`:

```typescript
import { pgTable, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Enable pgvector extension - run this manually in Neon console first:
// CREATE EXTENSION IF NOT EXISTS vector;

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  filename: text('filename').notNull(),
  textContent: text('text_content').notNull(),
  charCount: integer('char_count').notNull(),
  chunkCount: integer('chunk_count'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  text: text('text').notNull(),
  embedding: text('embedding'), // Store as JSON string, parse when needed
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  documentIdx: index('chunks_document_idx').on(table.documentId)
}));

export const summaries = pgTable('summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  model: text('model').notNull(), // 'claude' or 'openai'
  content: text('content').notNull(),
  latencyMs: integer('latency_ms').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const queries = pgTable('queries', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  question: text('question').notNull(),
  claudeResponse: text('claude_response').notNull(),
  claudeLatencyMs: integer('claude_latency_ms').notNull(),
  openaiResponse: text('openai_response').notNull(),
  openaiLatencyMs: integer('openai_latency_ms').notNull(),
  chunksUsed: jsonb('chunks_used').notNull(), // Array of chunk IDs
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  referenceType: text('reference_type').notNull(), // 'summary' or 'query'
  referenceId: uuid('reference_id').notNull(),
  model: text('model').notNull(), // 'claude' or 'openai'
  rating: text('rating').notNull(), // 'up' or 'down'
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const comparisons = pgTable('comparisons', {
  id: uuid('id').primaryKey().defaultRandom(),
  referenceType: text('reference_type').notNull(), // 'summary' or 'query'
  referenceId: uuid('reference_id').notNull(),
  winner: text('winner').notNull(), // 'claude', 'openai', or 'tie'
  createdAt: timestamp('created_at').defaultNow().notNull()
});
```

## File Structure

```
document-summarizer-v2/
├── app/
│   ├── page.tsx                      # Main page: upload + summary
│   ├── qa/[docId]/page.tsx           # Q&A page for specific document
│   ├── evals/page.tsx                # Eval dashboard
│   ├── layout.tsx                    # Root layout
│   ├── globals.css                   # Tailwind imports
│   └── api/
│       ├── upload/route.ts           # POST: upload PDF, extract text
│       ├── embed/route.ts            # POST: chunk and embed document
│       ├── summarize/route.ts        # POST: generate side-by-side summaries
│       ├── query/route.ts            # POST: RAG Q&A with both models
│       ├── feedback/route.ts         # POST: log thumbs up/down
│       ├── compare/route.ts          # POST: log winner vote
│       └── evals/route.ts            # GET: return dashboard stats
├── components/
│   ├── FileUpload.tsx                # Drag-and-drop PDF upload
│   ├── ProcessingSteps.tsx           # Show progress: extracting, chunking, etc.
│   ├── SideBySide.tsx                # Two-column comparison layout
│   ├── SummaryCard.tsx               # Single summary with feedback buttons
│   ├── CompareButtons.tsx            # "Claude better" / "OpenAI better" / "Tie"
│   ├── QAChat.tsx                    # Question input + response display
│   ├── EvalDashboard.tsx             # Stats and charts
│   └── Navigation.tsx                # Nav between pages
├── lib/
│   ├── db.ts                         # Drizzle + Neon connection
│   ├── anthropic.ts                  # Claude API wrapper
│   ├── openai.ts                     # OpenAI API wrapper
│   ├── embeddings.ts                 # Generate embeddings
│   ├── chunking.ts                   # Text chunking logic
│   ├── retrieval.ts                  # Cosine similarity search
│   └── pdf.ts                        # PDF text extraction
├── db/
│   └── schema.ts                     # Database schema (above)
├── drizzle.config.ts                 # Drizzle config
├── .env.local                        # Environment variables
└── package.json
```

## Library Implementations

### lib/db.ts

```typescript
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@/db/schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

### lib/anthropic.ts

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

interface GenerateResponse {
  content: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export async function generateWithClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 1024
): Promise<GenerateResponse> {
  const start = Date.now();
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });
  
  const latencyMs = Date.now() - start;
  
  return {
    content: response.content[0].type === 'text' ? response.content[0].text : '',
    latencyMs,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens
  };
}
```

### lib/openai.ts

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

interface GenerateResponse {
  content: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export async function generateWithOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 1024
): Promise<GenerateResponse> {
  const start = Date.now();
  
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });
  
  const latencyMs = Date.now() - start;
  
  return {
    content: response.choices[0].message.content || '',
    latencyMs,
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0
  };
}
```

### lib/embeddings.ts

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  
  return response.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts
  });
  
  return response.data.map(d => d.embedding);
}
```

### lib/chunking.ts

```typescript
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

export interface Chunk {
  index: number;
  text: string;
}

export function chunkText(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;
  
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunkText = text.slice(start, end);
    
    chunks.push({
      index,
      text: chunkText.trim()
    });
    
    start = end - CHUNK_OVERLAP;
    if (start >= text.length - CHUNK_OVERLAP) break;
    index++;
  }
  
  return chunks.filter(c => c.text.length > 0);
}
```

### lib/retrieval.ts

```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}

export interface RetrievedChunk {
  id: string;
  text: string;
  score: number;
}

export function retrieveTopK(
  queryEmbedding: number[],
  chunks: { id: string; text: string; embedding: number[] }[],
  k: number = 5
): RetrievedChunk[] {
  const scored = chunks.map(chunk => ({
    id: chunk.id,
    text: chunk.text,
    score: cosineSimilarity(queryEmbedding, chunk.embedding)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, k);
}
```

### lib/pdf.ts

```typescript
import pdf from 'pdf-parse';

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}
```

## API Route Implementations

### app/api/upload/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/db/schema';
import { extractTextFromPDF } from '@/lib/pdf';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const textContent = await extractTextFromPDF(buffer);
    
    if (!textContent || textContent.trim().length === 0) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 });
    }
    
    const [document] = await db.insert(documents).values({
      filename: file.name,
      textContent: textContent,
      charCount: textContent.length
    }).returning();
    
    return NextResponse.json({
      documentId: document.id,
      filename: document.filename,
      charCount: document.charCount
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 });
  }
}
```

### app/api/embed/route.ts

```typescript
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
    console.error('Embed error:', error);
    return NextResponse.json({ error: 'Failed to embed document' }, { status: 500 });
  }
}
```

### app/api/summarize/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, summaries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateWithClaude } from '@/lib/anthropic';
import { generateWithOpenAI } from '@/lib/openai';

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
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }
    
    // Get document
    const [document] = await db.select().from(documents).where(eq(documents.id, documentId));
    
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    const textToSummarize = document.textContent.slice(0, MAX_INPUT_CHARS);
    const userPrompt = `Please summarize this document:\n\n${textToSummarize}`;
    
    // Call both models in parallel
    const [claudeResult, openaiResult] = await Promise.all([
      generateWithClaude(SYSTEM_PROMPT, userPrompt),
      generateWithOpenAI(SYSTEM_PROMPT, userPrompt)
    ]);
    
    // Store summaries
    const [claudeSummary] = await db.insert(summaries).values({
      documentId,
      model: 'claude',
      content: claudeResult.content,
      latencyMs: claudeResult.latencyMs,
      inputTokens: claudeResult.inputTokens,
      outputTokens: claudeResult.outputTokens
    }).returning();
    
    const [openaiSummary] = await db.insert(summaries).values({
      documentId,
      model: 'openai',
      content: openaiResult.content,
      latencyMs: openaiResult.latencyMs,
      inputTokens: openaiResult.inputTokens,
      outputTokens: openaiResult.outputTokens
    }).returning();
    
    return NextResponse.json({
      claude: {
        id: claudeSummary.id,
        content: claudeResult.content,
        latencyMs: claudeResult.latencyMs
      },
      openai: {
        id: openaiSummary.id,
        content: openaiResult.content,
        latencyMs: openaiResult.latencyMs
      }
    });
    
  } catch (error) {
    console.error('Summarize error:', error);
    return NextResponse.json({ error: 'Failed to generate summaries' }, { status: 500 });
  }
}
```

### app/api/query/route.ts

```typescript
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
```

### app/api/feedback/route.ts

```typescript
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
    console.error('Feedback error:', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}
```

### app/api/compare/route.ts

```typescript
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
    console.error('Compare error:', error);
    return NextResponse.json({ error: 'Failed to save comparison' }, { status: 500 });
  }
}
```

### app/api/evals/route.ts

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, queries, summaries, feedback, comparisons } from '@/db/schema';
import { sql, eq, desc } from 'drizzle-orm';

export async function GET() {
  try {
    // Total counts
    const [docCount] = await db.select({ count: sql<number>`count(*)` }).from(documents);
    const [queryCount] = await db.select({ count: sql<number>`count(*)` }).from(queries);
    const [comparisonCount] = await db.select({ count: sql<number>`count(*)` }).from(comparisons);
    
    // Win rates
    const comparisonResults = await db.select().from(comparisons);
    const claudeWins = comparisonResults.filter(c => c.winner === 'claude').length;
    const openaiWins = comparisonResults.filter(c => c.winner === 'openai').length;
    const ties = comparisonResults.filter(c => c.winner === 'tie').length;
    const totalComparisons = comparisonResults.length || 1; // Avoid division by zero
    
    // Thumbs up rates
    const feedbackResults = await db.select().from(feedback);
    const claudeFeedback = feedbackResults.filter(f => f.model === 'claude');
    const openaiFeedback = feedbackResults.filter(f => f.model === 'openai');
    
    const claudeThumbsUp = claudeFeedback.filter(f => f.rating === 'up').length;
    const openaiThumbsUp = openaiFeedback.filter(f => f.rating === 'up').length;
    
    // Average latencies
    const allQueries = await db.select().from(queries);
    const claudeLatencies = allQueries.map(q => q.claudeLatencyMs);
    const openaiLatencies = allQueries.map(q => q.openaiLatencyMs);
    
    const avgClaudeLatency = claudeLatencies.length 
      ? claudeLatencies.reduce((a, b) => a + b, 0) / claudeLatencies.length 
      : 0;
    const avgOpenaiLatency = openaiLatencies.length 
      ? openaiLatencies.reduce((a, b) => a + b, 0) / openaiLatencies.length 
      : 0;
    
    // Recent comparisons
    const recentComparisons = await db
      .select({
        id: comparisons.id,
        referenceType: comparisons.referenceType,
        winner: comparisons.winner,
        createdAt: comparisons.createdAt
      })
      .from(comparisons)
      .orderBy(desc(comparisons.createdAt))
      .limit(10);
    
    return NextResponse.json({
      totalDocuments: Number(docCount.count),
      totalQueries: Number(queryCount.count),
      totalComparisons: Number(comparisonCount.count),
      
      claudeWinRate: Math.round((claudeWins / totalComparisons) * 100),
      openaiWinRate: Math.round((openaiWins / totalComparisons) * 100),
      tieRate: Math.round((ties / totalComparisons) * 100),
      
      claudeThumbsUpRate: claudeFeedback.length 
        ? Math.round((claudeThumbsUp / claudeFeedback.length) * 100) 
        : 0,
      openaiThumbsUpRate: openaiFeedback.length 
        ? Math.round((openaiThumbsUp / openaiFeedback.length) * 100) 
        : 0,
      
      claudeAvgLatencyMs: Math.round(avgClaudeLatency),
      openaiAvgLatencyMs: Math.round(avgOpenaiLatency),
      
      recentComparisons
    });
    
  } catch (error) {
    console.error('Evals error:', error);
    return NextResponse.json({ error: 'Failed to get eval stats' }, { status: 500 });
  }
}
```

## UI Components

### components/FileUpload.tsx

A drag-and-drop file upload component that:
- Accepts only PDF files
- Shows file name and size after selection
- Has an "Upload" button that calls POST /api/upload
- Shows loading state during upload
- Returns documentId on success

### components/ProcessingSteps.tsx

Shows processing pipeline with checkmarks:
- ✓ Extracting text...
- ✓ Chunking document...
- ✓ Generating embeddings...
- ✓ Generating summaries...

Each step shows loading spinner until complete, then checkmark.

### components/SideBySide.tsx

Two-column layout with:
- Left column: Claude response with header "Claude" and latency badge
- Right column: OpenAI response with header "OpenAI" and latency badge
- Each column has thumbs up/down buttons at bottom
- Center area between columns has CompareButtons

Props:
```typescript
interface SideBySideProps {
  claude: { id: string; content: string; latencyMs: number };
  openai: { id: string; content: string; latencyMs: number };
  referenceType: 'summary' | 'query';
  referenceId: string;
}
```

### components/SummaryCard.tsx

Single model response card with:
- Model name header (Claude or OpenAI)
- Latency badge (e.g., "1.2s")
- Markdown-rendered content
- Thumbs up/down buttons

### components/CompareButtons.tsx

Three buttons in a row:
- "Claude is better" (orange)
- "Tie" (gray)
- "OpenAI is better" (green)

Calls POST /api/compare when clicked. Shows selected state after voting.

### components/QAChat.tsx

- Text input for question
- Submit button
- Shows loading state while processing
- Displays SideBySide component with responses

### components/EvalDashboard.tsx

Dashboard showing:
- Total documents, queries, comparisons (big numbers)
- Win rate bar chart (Claude vs OpenAI vs Tie)
- Thumbs up rate comparison
- Average latency comparison
- Recent comparisons table

### components/Navigation.tsx

Simple nav bar with links:
- Document Summarizer (home)
- Eval Dashboard (/evals)

## Pages

### app/page.tsx

Main page flow:
1. Show FileUpload component
2. After upload success, show ProcessingSteps
3. Call POST /api/embed
4. Call POST /api/summarize
5. Show SideBySide with summaries
6. Show "Ask Questions" button that links to /qa/[docId]

### app/qa/[docId]/page.tsx

Q&A page:
1. Show document filename at top
2. Show QAChat component
3. Each Q&A exchange shows as SideBySide below the input
4. Multiple questions can be asked in sequence

### app/evals/page.tsx

Dashboard page:
1. Fetch GET /api/evals on mount
2. Display EvalDashboard component with stats

## Styling Guidelines

Use Tailwind CSS with a dark theme similar to the original screenshots:
- Background: bg-gray-900
- Cards: bg-gray-800 with rounded-lg
- Text: text-white, text-gray-300 for secondary
- Accent for Claude: orange (bg-orange-500)
- Accent for OpenAI: green (bg-green-500)
- Buttons: rounded-md with hover states

## Critical Rules

1. **DO NOT use LangChain or LlamaIndex** - implement RAG directly as shown
2. **DO NOT change the models** - Claude: claude-sonnet-4-20250514, OpenAI: gpt-4o-mini
3. **DO NOT add authentication** - keep it simple
4. **DO NOT use streaming** - simpler to implement and debug for v1
5. **ALWAYS track latency** for every LLM call
6. **ALWAYS use Promise.all()** for parallel Claude/OpenAI calls
7. **ALWAYS handle errors** with try/catch and proper status codes
8. **Embeddings are OpenAI only** - Claude doesn't have an embedding model

## Build Order

1. Set up Next.js project with dependencies
2. Create database schema and run migrations
3. Implement lib/ files (db, anthropic, openai, embeddings, chunking, retrieval, pdf)
4. Implement API routes in order: upload → embed → summarize → query → feedback → compare → evals
5. Implement components
6. Implement pages
7. Test full flow
8. Deploy to Vercel
