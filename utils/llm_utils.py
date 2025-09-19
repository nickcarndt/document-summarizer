import os
from dataclasses import dataclass
from typing import List, Tuple

import numpy as np
from openai import OpenAI


client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


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
