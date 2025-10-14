# ☁️ Google Cloud Deployment Notes

**Live Demo:** [https://docsum-612742012896.us-central1.run.app](https://docsum-612742012896.us-central1.run.app)

## Stack Overview
- **Frontend/UI:** Streamlit (Python)
- **Backend:** OpenAI GPT-4o-mini for summarization + embeddings
- **Infra:** Google Cloud Run (containerized)
- **Storage:** Google Cloud Storage (PDF uploads)
- **Secrets:** Google Secret Manager (OpenAI API key)
- **Build:** Cloud Build (Dockerized pipeline)

## Architecture Diagram
┌──────────────────────────┐
│ User uploads PDF         │
│ via Streamlit frontend   │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Cloud Run container      │
│ - Runs Streamlit app     │
│ - Fetches secret (API)   │
│ - Calls OpenAI API       │
│ - Stores PDFs in GCS     │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Google Cloud Storage     │
│ (Bucket for uploads)     │
└──────────────────────────┘  

## How It Works
1. User uploads a PDF.
2. Streamlit extracts text and calls OpenAI for a summary.
3. Summaries + embeddings are generated on the fly.
4. User can query the document via RAG-style retrieval.

## Deployment Steps
1. Build container with `gcloud builds submit`
2. Deploy to Cloud Run with `gcloud run deploy`
3. Secrets + buckets configured via GCP CLI
