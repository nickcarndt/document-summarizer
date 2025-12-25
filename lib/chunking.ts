const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

export interface Chunk {
  index: number;
  text: string;
}

export function chunkText(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;
  
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunkText = text.slice(start, end);
    
    chunks.push({
      index,
      text: chunkText.trim()
    });
    
    start = end - CHUNK_OVERLAP;
    if (start >= text.length - CHUNK_OVERLAP) break;
    index++;
  }
  
  return chunks.filter(c => c.text.length > 0);
}

