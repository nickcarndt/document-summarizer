# Vercel Deployment Guide

## Prerequisites

1. ✅ Code is pushed to GitHub
2. ✅ Build passes locally (`npm run build`)
3. ✅ All environment variables documented

## Deployment Steps

### 1. Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your GitHub repository: `nickcarndt/document-summarizer`
4. Vercel will auto-detect Next.js configuration

### 2. Configure Environment Variables

In Vercel project settings, add these environment variables:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

**Important:**
- Add these in **Project Settings → Environment Variables**
- Add for **Production**, **Preview**, and **Development** environments
- Use Vercel's encrypted environment variables (never commit secrets)

### 3. Configure Build Settings

Vercel should auto-detect:
- **Framework Preset:** Next.js
- **Build Command:** `npm run build` (default)
- **Output Directory:** `.next` (default)
- **Install Command:** `npm install` (default)

### 4. Database Setup

**Before first deployment:**

1. **Enable pgvector extension in Neon:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Run database migrations:**
   - Option A: Run locally and push to Neon
     ```bash
     npm run db:generate
     npm run db:migrate
     ```
   - Option B: Use Neon SQL Editor to run migrations manually

3. **Verify tables exist:**
   - `documents`
   - `chunks`
   - `summaries`
   - `queries`
   - `feedback`
   - `comparisons`

### 5. Deploy

1. Click "Deploy" in Vercel
2. Wait for build to complete
3. Check deployment logs for any errors

### 6. Post-Deployment

1. **Test the deployment:**
   - Visit your Vercel URL
   - Try uploading a PDF
   - Check API routes are working

2. **Monitor logs:**
   - Use Vercel's built-in logging
   - Check for any runtime errors
   - Verify environment variables are loaded

3. **Set up custom domain (optional):**
   - Project Settings → Domains
   - Add your custom domain

## Troubleshooting

### Build Fails

- Check build logs in Vercel dashboard
- Verify all dependencies are in `package.json`
- Ensure `autoprefixer` is in `devDependencies` ✅

### Database Connection Errors

- Verify `DATABASE_URL` is set correctly in Vercel
- Check Neon database is accessible
- Ensure pgvector extension is enabled

### API Errors

- Check environment variables are set
- Verify API keys are valid
- Check Vercel function logs

### Runtime Errors

- Check Vercel function logs
- Verify database migrations have run
- Check for missing environment variables

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key from Anthropic |
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4o-mini and embeddings |
| `DATABASE_URL` | Yes | Neon Postgres connection string |

## Build Output

Expected build output:
```
✓ Compiled successfully
○ Static pages
ƒ Dynamic API routes
```

## Next Steps After Deployment

1. Run database migrations
2. Test full workflow (upload → embed → summarize → query)
3. Monitor performance and errors
4. Set up Vercel Analytics (optional)

