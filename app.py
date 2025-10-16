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
client = OpenAI()  # auto-detects OPENAI_API_KEY from environment

st.set_page_config(
    page_title="Document Summarizer", 
    page_icon="📄", 
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Load custom CSS with proper error handling
try:
    with open('.streamlit/style.css', 'r') as f:
        css_content = f.read()
        st.markdown(f'<style>{css_content}</style>', unsafe_allow_html=True)
except FileNotFoundError:
    # Fallback to inline CSS if file not found
    st.markdown("""
    <style>
    .main-header { padding: 5rem 0 4rem 0; margin-bottom: 4rem; background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%); border-bottom: 1px solid #e2e8f0; }
    .main-header h1 { font-size: 2.5rem; font-weight: 700; color: #1e293b; margin: 0; }
    .main-header .subtitle { font-size: 1.125rem; color: #64748b; margin-top: 0.5rem; }
    .upload-container { background: #ffffff; border: 2px dashed #e2e8f0; border-radius: 0.75rem; padding: 3rem 2rem; text-align: center; margin: 2rem 0; }
    .upload-icon { width: 80px; height: 80px; background: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; color: white; font-size: 2rem; }
    .upload-text { font-size: 1.25rem; font-weight: 500; color: #1e293b; margin-bottom: 0.5rem; }
    .upload-subtext { font-size: 0.875rem; color: #64748b; }
    .file-info-card { background: #ffffff; border-radius: 0.5rem; padding: 1.5rem; margin: 1rem 0; border-left: 4px solid #2563eb; }
    .file-info-success { border-left-color: #059669; }
    .file-info-warning { border-left-color: #d97706; }
    .file-info-error { border-left-color: #dc2626; }
    .content-section { background: #ffffff; border-radius: 0.75rem; padding: 2rem; margin: 1.5rem 0; border: 1px solid #e2e8f0; }
    .section-title { font-size: 1.5rem; font-weight: 600; color: #1e293b; margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 2px solid #e2e8f0; }
    .summary-content { font-size: 1.125rem; line-height: 1.7; color: #1e293b; background: #f8fafc; padding: 1.5rem; border-radius: 0.5rem; border-left: 4px solid #2563eb; }
    .key-point { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 0.9rem; margin: 0.7rem 0; }
    .qa-container { background: #ffffff; border-radius: 0.75rem; padding: 2rem; margin: 2rem 0; border: 1px solid #e2e8f0; }
    .answer-content { background: #fafbfc; border-radius: 0.5rem; padding: 1.5rem; border-left: 4px solid #059669; font-size: 1rem; line-height: 1.6; color: #1e293b; margin-top: 1rem; border: 1px solid #e2e8f0; }
    .stFileUploader > div > div > button { background: #f0f0f0 !important; color: #1e293b !important; border: 1px solid #e2e8f0 !important; border-radius: 0.5rem !important; }
    .stFileUploader > div > div > button:hover { background: #2563eb !important; color: white !important; border-color: #2563eb !important; }
    .stTextInput > div > div > input { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 0.5rem !important; }
    .stTextInput > div > div > input:focus { border-color: #2563eb !important; box-shadow: 0 0 0 3px rgb(37 99 235 / 0.1) !important; }
    </style>
    """, unsafe_allow_html=True)
except Exception as e:
    st.error("Failed to load custom styling")

# Professional header
st.markdown("""
<div class="main-header">
    <h1>Document Summarizer</h1>
    <div class="subtitle">AI-powered document analysis and intelligent Q&A</div>
</div>
""", unsafe_allow_html=True)

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

def summarize_text(text: str) -> Tuple[str, List[str]]:
    prompt = (
        "You are an analyst. Summarize the following document in a concise paragraph, "
        "then extract 5-8 key bullet points. Be concrete and faithful to the text.\n\n"
        f"Document:\n{text[:20000]}"
    )

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a professional document analyst."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=512,
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
            # Clean up bullet points and remove redundant headers
            clean_line = line.lstrip('-* ').strip()
            # Skip lines that are just headers like "Key Bullet Points:" or "Key Points:"
            if not clean_line.lower().endswith((':', 'points:', 'bullet points:', 'insights:', 'summary:')):
                bullets.append(clean_line)
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

def build_retriever(text: str) -> RetrieverState:
    chunks = _chunk_text(text)
    resp = client.embeddings.create(model="text-embedding-3-small", input=chunks)
    vectors = np.array([d.embedding for d in resp.data], dtype=np.float32)
    return RetrieverState(chunks=chunks, embeddings=vectors, embedding_model="text-embedding-3-small")

def _cosine_sim_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    a_norm = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-8)
    b_norm = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-8)
    return a_norm @ b_norm.T

def _top_k_indices(similarities: np.ndarray, k: int = 5) -> List[int]:
    return list(np.argsort(-similarities)[:k])

def answer_question(question: str, retriever: RetrieverState) -> str:
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
        model="gpt-4o-mini",
        messages=messages,
        max_tokens=300,
        temperature=0.2,
    )
    return resp.choices[0].message.content or ""

# Professional UI Layout
# Check API key status
openai_key_present = bool(os.getenv("OPENAI_API_KEY"))

if not openai_key_present:
    st.error("OpenAI API key not found. Please set your OPENAI_API_KEY environment variable.")
    st.info("Create a .env file in the project root with: OPENAI_API_KEY=sk-your-actual-key-here")
    st.stop()

# Professional file upload section
st.markdown("""
<div class="upload-container">
    <div class="upload-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M16 13H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M16 17H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    </div>
    <div class="upload-text">Upload Document</div>
    <div class="upload-subtext">Select a PDF document for AI-powered analysis and summarization</div>
</div>
""", unsafe_allow_html=True)

uploaded_file = st.file_uploader("", type=["pdf"], label_visibility="collapsed")

if uploaded_file is None:
    st.info("Please upload a PDF document to begin analysis.")
    st.stop()

# File validation and status - optimized for performance
if uploaded_file is not None:
    # Get file size efficiently without loading entire file
    file_size_bytes = len(uploaded_file.getvalue())
    file_size_mb = file_size_bytes / (1024 * 1024)
    
    if file_size_mb > 32:
        st.markdown(f"""
        <div class="file-info-card file-info-error">
            <strong>File Size Error</strong><br>
            Document size ({file_size_mb:.1f} MB) exceeds the 32MB limit. Please use a smaller file.
        </div>
        """, unsafe_allow_html=True)
        st.stop()
    elif file_size_mb > 25:
        st.markdown(f"""
        <div class="file-info-card file-info-warning">
            <strong>Large Document</strong><br>
            Processing {file_size_mb:.1f} MB document. This may take additional time.
        </div>
        """, unsafe_allow_html=True)
    else:
        st.markdown(f"""
        <div class="file-info-card file-info-success" style="opacity: 0.8; margin-bottom: 1rem;">
            <strong>Document Loaded</strong><br>
            {uploaded_file.name} ({file_size_mb:.1f} MB)
        </div>
        """, unsafe_allow_html=True)

# Extract text - optimized to avoid double file reading
try:
    with st.status("Extracting text from document...", expanded=False):
        # Use the already loaded file content
        pdf_bytes = uploaded_file.getvalue()
        text = extract_text_from_pdf(io.BytesIO(pdf_bytes))
        
    if not text.strip():
        st.error("No extractable text found in the PDF document.")
        st.stop()
        
except Exception as e:
    st.error(f"Error processing PDF: {str(e)}")
    st.stop()

# Generate summary
with st.status("Generating AI summary...", expanded=False):
    summary, bullets = summarize_text(text)

# Display results in professional sections
st.markdown('<div class="content-section">', unsafe_allow_html=True)
st.markdown('<div class="section-title">Document Summary</div>', unsafe_allow_html=True)
st.markdown(f'<div class="summary-content">{summary}</div>', unsafe_allow_html=True)
st.markdown('</div>', unsafe_allow_html=True)

st.markdown('<div class="content-section">', unsafe_allow_html=True)
st.markdown('<div class="section-title">Key Insights</div>', unsafe_allow_html=True)
for bullet in bullets:
    st.markdown(f'<div class="key-point">{bullet}</div>', unsafe_allow_html=True)
st.markdown('</div>', unsafe_allow_html=True)

# Build retriever for Q&A
with st.status("Building search index...", expanded=False):
    retriever_state = build_retriever(text)

st.markdown('<div class="qa-container">', unsafe_allow_html=True)
st.markdown('<div class="section-title">Document Q&A</div>', unsafe_allow_html=True)
st.markdown('<p>Ask specific questions about the document content.</p>', unsafe_allow_html=True)

question = st.text_input("", placeholder="Enter your question about the document...", label_visibility="collapsed")
if question:
    with st.status("Analyzing document...", expanded=False):
        answer = answer_question(question=question, retriever=retriever_state)
    st.markdown('<div class="answer-content"><strong>Answer:</strong><br><br>' + answer + '</div>', unsafe_allow_html=True)
st.markdown('</div>', unsafe_allow_html=True)