export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}

export interface RetrievedChunk {
  id: string;
  text: string;
  score: number;
}

export function retrieveTopK(
  queryEmbedding: number[],
  chunks: { id: string; text: string; embedding: number[] }[],
  k: number = 5
): RetrievedChunk[] {
  const scored = chunks.map(chunk => ({
    id: chunk.id,
    text: chunk.text,
    score: cosineSimilarity(queryEmbedding, chunk.embedding)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, k);
}

