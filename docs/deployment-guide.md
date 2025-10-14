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
1. User uploads a PDF via the Streamlit frontend.
2. The app extracts text and calls the OpenAI API for summarization.
3. Summaries + embeddings are generated on the fly.
4. User can query the document using RAG-style retrieval.
5. Uploaded files are stored in a secure Google Cloud Storage bucket.

## Deployment Steps

### 1️⃣ Build and Push Container
```bash
gcloud builds submit --tag gcr.io/named-griffin-448720-k0/docsum:v1

gcloud run deploy docsum \
  --image gcr.io/named-griffin-448720-k0/docsum:v1 \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GCS_BUCKET=named-griffin-448720-k0-docsum-uploads \
  --set-secrets OPENAI_API_KEY=OPENAI_API_KEY:latest

# Create Secret for OpenAI API key
echo "sk-your-key" | gcloud secrets create OPENAI_API_KEY --data-file=-

# Grant Cloud Run access to Secret
PROJECT_NUMBER=$(gcloud projects describe named-griffin-448720-k0 --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding OPENAI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Create Cloud Storage bucket for uploads
gcloud storage buckets create gs://named-griffin-448720-k0-docsum-uploads --location=us-central1
