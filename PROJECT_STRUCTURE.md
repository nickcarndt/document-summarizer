# Document Summarizer - Project File Structure

## Root Directory
```
document-summarizer/
├── app/                          # Next.js App Router
│   ├── api/                     # API Routes
│   │   ├── compare/             # Comparison voting endpoint
│   │   │   └── route.ts
│   │   ├── document/            # Document metadata
│   │   │   └── [docId]/
│   │   │       └── route.ts
│   │   ├── embed/               # Document embedding
│   │   │   └── route.ts
│   │   ├── evals/               # Evaluation dashboard data
│   │   │   ├── export/          # Export evaluation data
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   ├── feedback/            # Thumbs up/down feedback
│   │   │   └── route.ts
│   │   ├── query/               # RAG Q&A endpoint
│   │   │   └── route.ts
│   │   ├── summaries/           # Fetch existing summaries
│   │   │   └── [docId]/
│   │   │       └── route.ts
│   │   ├── summarize/           # Generate summaries
│   │   │   └── route.ts
│   │   └── upload/              # PDF upload endpoint
│   │       └── route.ts
│   ├── document/                # Document pages
│   │   └── [docId]/
│   │       ├── page.tsx         # Document summary view
│   │       └── qa/
│   │           └── page.tsx    # Q&A view
│   ├── evals/                   # Evaluation dashboard
│   │   └── page.tsx
│   ├── qa/                      # Q&A pages (alternative route)
│   │   └── [docId]/
│   │       └── page.tsx
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Home/upload page
│
├── components/                   # React components
│   ├── CompareButtons.tsx        # Head-to-head voting buttons
│   ├── EvalDashboard.tsx        # Evaluation metrics dashboard
│   ├── FileUpload.tsx            # PDF upload component
│   ├── Navigation.tsx            # Navigation bar
│   ├── ProcessingSteps.tsx      # Processing status indicator
│   ├── QAChat.tsx                # Q&A chat interface
│   ├── SideBySide.tsx            # Side-by-side comparison view
│   ├── SummaryCard.tsx           # Individual summary card
│   ├── SummarySkeleton.tsx       # Loading skeleton
│   └── Tooltip.tsx               # Tooltip component
│
├── lib/                          # Utility libraries
│   ├── anthropic.ts             # Claude API wrapper
│   ├── chunking.ts               # Text chunking logic
│   ├── db.ts                     # Database connection
│   ├── embeddings.ts             # OpenAI embeddings
│   ├── logger.ts                 # Logging utility
│   ├── openai.ts                 # OpenAI API wrapper
│   ├── pdf.ts                    # PDF parsing
│   ├── retrieval.ts              # RAG retrieval (cosine similarity)
│   └── utils.ts                  # General utilities
│
├── db/                           # Database schema
│   └── schema.ts                 # Drizzle ORM schema
│
├── scripts/                     # Utility scripts
│   ├── check-db-data.ts         # Database inspection
│   ├── cleanup-old-duplicates.ts # Cleanup old duplicates
│   ├── cleanup-production-duplicates.ts # Production cleanup
│   ├── cleanup-specific-duplicates.ts   # Specific cleanup
│   ├── find-all-duplicates.ts    # Find duplicates
│   ├── reset-database.ts         # Reset evaluation data
│   └── test-date-filter.ts      # Test date filtering
│
├── drizzle/                      # Drizzle migrations
│   ├── 0000_damp_invaders.sql   # Initial migration
│   └── meta/
│       ├── _journal.json         # Migration journal
│       └── 0000_snapshot.json    # Schema snapshot
│
├── screenshots/                  # Project screenshots
│   ├── README.md                 # Screenshot instructions
│   ├── screenshot1.png
│   ├── screenshot2.png
│   └── screenshot3.png
│
├── docs/                         # Documentation (empty)
│
├── .gitattributes                # Git attributes (language detection)
├── .gitignore                    # Git ignore rules
├── BUG_FIXES_AND_UX_IMPROVEMENTS (outdated).md
├── CLEANUP_REPORT.md
├── DEPLOYMENT_BEST_PRACTICES.md
├── DEPLOYMENT_CHECKLIST.md
├── drizzle.config.ts             # Drizzle configuration
├── GITHUB_REPO_UPDATE.md
├── next.config.js                # Next.js configuration
├── next-env.d.ts                 # Next.js type definitions
├── package.json                  # Dependencies
├── package-lock.json             # Lock file
├── postcss.config.js             # PostCSS configuration
├── README.md                      # Main documentation
├── SMOKE_TEST_REPORT.md
├── tailwind.config.ts            # Tailwind CSS configuration
├── TESTING_CHECKLIST.md
├── tsconfig.json                 # TypeScript configuration
├── vercel.json                   # Vercel deployment config
└── VERIFICATION_CHECKLIST.md
```

## File Count Summary

- **API Routes**: 10 endpoints
- **Pages**: 5 pages
- **Components**: 10 React components
- **Libraries**: 9 utility modules
- **Scripts**: 7 utility scripts
- **Config Files**: 8 configuration files
- **Documentation**: 11 markdown files

## Key Files by Function

### Core Application
- `app/page.tsx` - Home/upload page
- `app/document/[docId]/page.tsx` - Document summary view
- `app/document/[docId]/qa/page.tsx` - Q&A interface
- `app/evals/page.tsx` - Evaluation dashboard

### API Endpoints
- `app/api/upload/route.ts` - PDF upload
- `app/api/embed/route.ts` - Document embedding
- `app/api/summarize/route.ts` - Summary generation
- `app/api/query/route.ts` - RAG Q&A
- `app/api/feedback/route.ts` - Thumbs up/down
- `app/api/compare/route.ts` - Head-to-head voting
- `app/api/evals/route.ts` - Dashboard metrics
- `app/api/evals/export/route.ts` - Data export

### Database
- `db/schema.ts` - Drizzle ORM schema (documents, chunks, summaries, queries, feedback, comparisons)

### LLM Integration
- `lib/anthropic.ts` - Claude Haiku wrapper
- `lib/openai.ts` - GPT-4o-mini wrapper
- `lib/embeddings.ts` - OpenAI embeddings

### RAG Implementation
- `lib/chunking.ts` - Text chunking (1500 chars, 200 overlap)
- `lib/retrieval.ts` - Cosine similarity search

### UI Components
- `components/SummaryCard.tsx` - Individual summary with voting
- `components/CompareButtons.tsx` - Head-to-head comparison
- `components/EvalDashboard.tsx` - Metrics dashboard
- `components/QAChat.tsx` - Q&A interface

