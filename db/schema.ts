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

