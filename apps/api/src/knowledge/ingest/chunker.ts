// Document chunker — splits knowledge corpus into fixed-size overlapping chunks.
// Chunks are the unit of indexing for both BM25 and vector retrieval.

export interface KnowledgeChunk {
  chunkId:       string;   // {docId}:{chunkIndex}
  docId:         string;   // source document identifier
  title:         string;   // document title (inherited)
  source:        string;   // regulatory body or publication
  year:          number;   // publication year
  text:          string;   // chunk text (CHUNK_SIZE tokens approx)
  metadata:      Record<string, unknown>;
}

export interface ChunkOptions {
  chunkSize?:    number;   // characters; default 800
  overlap?:      number;   // overlap characters; default 200
}

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP    = 200;

export function chunkDocument(
  docId: string,
  title: string,
  source: string,
  year: number,
  text: string,
  metadata: Record<string, unknown> = {},
  opts: ChunkOptions = {},
): KnowledgeChunk[] {
  const size    = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = opts.overlap ?? DEFAULT_OVERLAP;

  // Split on paragraph boundaries first for semantic coherence
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  const chunks: KnowledgeChunk[] = [];
  let buffer = '';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    if (buffer.length + para.length > size && buffer.length > 0) {
      chunks.push({
        chunkId: `${docId}:${chunkIndex++}`,
        docId,
        title,
        source,
        year,
        text: buffer.trim(),
        metadata,
      });
      // Retain overlap from tail of current buffer
      buffer = buffer.slice(Math.max(0, buffer.length - overlap));
    }
    buffer += (buffer ? '\n\n' : '') + para;
  }

  if (buffer.trim().length > 0) {
    chunks.push({
      chunkId: `${docId}:${chunkIndex}`,
      docId,
      title,
      source,
      year,
      text: buffer.trim(),
      metadata,
    });
  }

  return chunks;
}
