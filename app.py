import os
import io
from typing import List, Tuple

import streamlit as st
from dotenv import load_dotenv

from utils.pdf_utils import extract_text_from_pdf
from utils.llm_utils import summarize_text, build_retriever, answer_question


load_dotenv()

st.set_page_config(page_title="Document AI Demo", page_icon="📄", layout="wide")

st.title("📄 Document Summarizer")
st.caption("Upload a PDF to get a concise summary, key bullets, and ask questions.")

with st.sidebar:
    st.header("Settings")
    openai_key_present = bool(os.getenv("OPENAI_API_KEY"))
    st.write("OpenAI API key:", "✅ found" if openai_key_present else "❌ missing")
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

uploaded_file = st.file_uploader("Upload PDF", type=["pdf"])  # type: ignore

if uploaded_file is None:
    st.info("Upload a PDF to begin.")
    st.stop()

# Extract text
with st.status("Extracting text…", expanded=False):
    pdf_bytes = uploaded_file.read()
    text = extract_text_from_pdf(io.BytesIO(pdf_bytes))

if not text.strip():
    st.error("No extractable text found in the PDF.")
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
