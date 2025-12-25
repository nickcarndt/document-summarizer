# Testing Checklist - Document Summarizer V2

## Phase 7: Test Full Flow

### Code Quality Checks ✅
- [x] No linter errors found
- [x] All TypeScript types are correct
- [x] All imports are valid
- [x] Drizzle config updated to use `dialect` instead of `driver`

### Architecture Verification ✅
- [x] All API routes follow the spec pattern
- [x] Parallel API calls implemented with Promise.all()
- [x] Latency tracking on all LLM calls
- [x] Error handling with try/catch and proper status codes
- [x] ReferenceId logic correct:
  - Summaries: feedback uses summary IDs, comparisons use documentId
  - Queries: both feedback and comparisons use queryId

### Component Integration ✅
- [x] All components are client components where needed
- [x] Navigation component integrated in layout
- [x] Dark theme styling consistent
- [x] All props properly typed

### Database Schema ✅
- [x] All 6 tables defined correctly
- [x] Foreign key relationships set up
- [x] Indexes created where needed
- [x] Cascade deletes configured

### API Routes ✅
- [x] `/api/upload` - PDF upload and text extraction
- [x] `/api/embed` - Chunking and embedding generation
- [x] `/api/summarize` - Parallel summary generation
- [x] `/api/query` - RAG Q&A with parallel model calls
- [x] `/api/feedback` - Thumbs up/down logging
- [x] `/api/compare` - Winner vote logging
- [x] `/api/evals` - Dashboard statistics

### Pages ✅
- [x] Main page (`/`) - Upload and summary flow
- [x] Q&A page (`/qa/[docId]`) - Question answering
- [x] Evals page (`/evals`) - Dashboard

### Environment Setup Required
Before running the application, ensure:
1. Create `.env.local` with:
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `DATABASE_URL`
2. Enable pgvector extension in Neon console:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Run database migrations:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

### Next Steps
1. Install dependencies: `npm install`
2. Set up environment variables
3. Run database migrations
4. Test locally: `npm run dev`
5. Build for production: `npm run build`

