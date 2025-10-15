import os
import io
from dataclasses import dataclass
from typing import List, Tuple
from io import BytesIO

from dotenv import load_dotenv

# Load environment variables before any other imports
load_dotenv()

import streamlit as st
import numpy as np
from openai import OpenAI
from pypdf import PdfReader

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
if api_key:
    # Debug: show first/last few chars of key (for troubleshooting)
    st.sidebar.write(f"API Key: {api_key[:8]}...{api_key[-8:]}")
    client = OpenAI(api_key=api_key)
else:
    st.sidebar.write("⚠️ No API key found")
    client = OpenAI()  # auto-detects OPENAI_API_KEY from environment

st.set_page_config(
    page_title="Document Summarizer", 
    page_icon="📄", 
    layout="wide",
    initial_sidebar_state="expanded"
)

st.title("📄 Document Summarizer")
st.caption("Upload a PDF to get a concise summary, key bullets, and ask questions.")

# PDF Processing Functions
def extract_text_from_pdf(pdf_bytes: BytesIO) -> str:
    """
    Extracts text from a PDF represented as a BytesIO stream.
    Returns a single concatenated string of all page texts.
    """
    reader = PdfReader(pdf_bytes)
    pages_text: List[str] = []
    for page in reader.pages:
        try:
            content = page.extract_text() or ""
        except Exception:
            content = ""
        pages_text.append(content.strip())
    return "\n\n".join(t for t in pages_text if t)

# LLM Processing Functions
def _chunk_text(text: str, max_chars: int = 1500, overlap: int = 200) -> List[str]:
    chunks: List[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + max_chars, n)
        chunk = text[start:end]
        chunks.append(chunk)
        if end == n:
            break
        start = max(0, end - overlap)
    return chunks

def summarize_text(text: str, model: str = "gpt-4o-mini", max_tokens: int = 512) -> Tuple[str, List[str]]:
    prompt = (
        "You are an analyst. Summarize the following document in a concise paragraph, "
        "then extract 5-8 key bullet points. Be concrete and faithful to the text.\n\n"
        f"Document:\n{text[:20000]}"
    )

    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=max_tokens,
        temperature=0.2,
    )

    content = resp.choices[0].message.content or ""

    # naive split: first paragraph as summary, remaining lines starting with - or * as bullets
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    if not lines:
        return content, []

    # Find the first blank-line break as summary paragraph end
    summary_lines: List[str] = []
    bullets: List[str] = []
    in_bullets = False
    for line in lines:
        if line.startswith(('-', '*')):
            in_bullets = True
            bullets.append(line.lstrip('-* ').strip())
        elif in_bullets:
            bullets.append(line)
        else:
            summary_lines.append(line)

    summary = " ".join(summary_lines).strip()
    return summary or content, bullets

@dataclass
class RetrieverState:
    chunks: List[str]
    embeddings: np.ndarray  # shape: (num_chunks, dim)
    embedding_model: str

def build_retriever(text: str, embedding_model: str = "text-embedding-3-small") -> RetrieverState:
    chunks = _chunk_text(text)
    resp = client.embeddings.create(model=embedding_model, input=chunks)
    vectors = np.array([d.embedding for d in resp.data], dtype=np.float32)
    return RetrieverState(chunks=chunks, embeddings=vectors, embedding_model=embedding_model)

def _cosine_sim_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    a_norm = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-8)
    b_norm = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-8)
    return a_norm @ b_norm.T

def _top_k_indices(similarities: np.ndarray, k: int = 5) -> List[int]:
    return list(np.argsort(-similarities)[:k])

def answer_question(question: str, retriever: RetrieverState, model: str = "gpt-4o-mini") -> str:
    # embed question
    q_embed = client.embeddings.create(model=retriever.embedding_model, input=[question]).data[0].embedding
    q_vec = np.array(q_embed, dtype=np.float32).reshape(1, -1)
    sims = _cosine_sim_matrix(q_vec, retriever.embeddings).reshape(-1)
    top_idx = _top_k_indices(sims, k=5)

    context_chunks = [retriever.chunks[i] for i in top_idx]
    context = "\n\n".join(context_chunks)

    messages = [
        {"role": "system", "content": "You answer questions using only the provided context. If unsure, say you don't know."},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}\nAnswer succinctly."},
    ]

    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=300,
        temperature=0.2,
    )
    return resp.choices[0].message.content or ""

# Streamlit UI
with st.sidebar:
    st.header("Settings")
    openai_key_present = bool(os.getenv("OPENAI_API_KEY"))
    if openai_key_present:
        key_preview = os.getenv("OPENAI_API_KEY", "")[:8] + "..." + os.getenv("OPENAI_API_KEY", "")[-8:]
        st.write("OpenAI API key:", f"✅ found ({key_preview})")
    else:
        st.write("OpenAI API key:", "❌ missing")
    default_model = st.selectbox(
        "Model",
        options=["gpt-4o-mini", "gpt-4o", "o4-mini"],
        index=0,
        help="Model used for summarization and Q&A",
    )
    embed_model = st.selectbox(
        "Embedding model",
        options=["text-embedding-3-small", "text-embedding-3-large"],
        index=0,
        help="Model used to embed document chunks for retrieval",
    )
    max_summary_tokens = st.slider("Max summary tokens", 256, 2048, 512, 64)

uploaded_file = st.file_uploader("Upload PDF", type=["pdf"], max_size=50)  # 50MB limit

if uploaded_file is None:
    st.info("Upload a PDF to begin.")
    st.stop()

# Extract text
try:
    with st.status("Extracting text…", expanded=False):
        pdf_bytes = uploaded_file.read()
        file_size_mb = len(pdf_bytes) / (1024 * 1024)
        st.write(f"File size: {file_size_mb:.1f} MB")
        
        if file_size_mb > 50:
            st.error("File too large. Please upload a PDF under 50MB.")
            st.stop()
            
        text = extract_text_from_pdf(io.BytesIO(pdf_bytes))
        
    if not text.strip():
        st.error("No extractable text found in the PDF.")
        st.stop()
        
except Exception as e:
    st.error(f"Error processing PDF: {str(e)}")
    st.stop()

# Summarize
with st.status("Summarizing…", expanded=False):
    summary, bullets = summarize_text(text, model=default_model, max_tokens=max_summary_tokens)

st.subheader("Summary")
st.write(summary)

st.subheader("Key Points")
for bullet in bullets:
    st.markdown(f"- {bullet}")

# Build retriever for Q&A
with st.status("Indexing for Q&A…", expanded=False):
    retriever_state = build_retriever(text, embedding_model=embed_model)

st.divider()
st.subheader("Ask questions about the document")
question = st.text_input("Your question")
if question:
    with st.status("Thinking…", expanded=False):
        answer = answer_question(
            question=question,
            retriever=retriever_state,
            model=default_model,
        )
    st.markdown("**Answer:**")
    st.write(answer)