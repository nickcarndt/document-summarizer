# Vercel Deployment Checklist

## Pre-Deployment ✅

- [x] Code pushed to GitHub
- [x] Build passes locally (`npm run build`)
- [x] All dependencies in `package.json`
- [x] Environment variables documented
- [x] `.env.example` created
- [x] `.gitignore` configured correctly
- [x] No hardcoded secrets
- [x] Logging system implemented

## Vercel Setup

- [ ] Import project from GitHub
- [ ] Configure environment variables:
  - [ ] `ANTHROPIC_API_KEY`
  - [ ] `OPENAI_API_KEY`
  - [ ] `DATABASE_URL`
- [ ] Verify build settings (auto-detected)
- [ ] Deploy to production

## Database Setup

- [ ] Enable pgvector extension in Neon:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- [ ] Run database migrations:
  ```bash
  npm run db:generate
  npm run db:migrate
  ```
- [ ] Verify all tables exist:
  - [ ] `documents`
  - [ ] `chunks`
  - [ ] `summaries`
  - [ ] `queries`
  - [ ] `feedback`
  - [ ] `comparisons`

## Post-Deployment Testing

- [ ] Home page loads
- [ ] Upload PDF document
- [ ] Document embedding works
- [ ] Summaries generate (Claude + OpenAI)
- [ ] Q&A functionality works
- [ ] Feedback submission works
- [ ] Comparison voting works
- [ ] Eval dashboard loads

## Monitoring

- [ ] Check Vercel function logs
- [ ] Monitor API response times
- [ ] Verify no errors in production
- [ ] Test with real PDF documents

