/**
 * Lightweight term-frequency vector store for image similarity detection.
 *
 * Strategy: each image's verbal description is tokenized into a normalized
 * TF vector. Similarity between images is computed via cosine similarity
 * on the union of their vocabularies. No external dependencies required.
 *
 * This is intentionally simple — for a local app with dozens of images,
 * an in-process approach is faster and more reliable than an external
 * vector DB. Can be swapped for Voyage AI embeddings later by replacing
 * `computeEmbedding()` and keeping the same cosine similarity logic.
 */

// --- Stop words to ignore during tokenization ---
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "this", "that",
  "these", "those", "it", "its", "as", "if", "not", "no", "so", "up",
  "out", "about", "into", "over", "after", "also", "very", "just",
  "than", "more", "some", "such", "only", "other", "which", "while",
]);

/**
 * Tokenize a description into meaningful terms.
 * Lowercases, removes punctuation, filters stop words,
 * and keeps tokens >= 3 chars.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

/**
 * Compute a term-frequency embedding from a text description.
 * Returns the vocabulary (sorted keys) and the normalized TF vector.
 */
export function computeEmbedding(description: string): {
  vocab: string[];
  vector: number[];
} {
  const tokens = tokenize(description);
  if (tokens.length === 0) {
    return { vocab: [], vector: [] };
  }

  // Count term frequencies
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  // Sort vocabulary for deterministic ordering
  const vocab = [...freq.keys()].sort();

  // Build raw TF vector
  const raw = vocab.map((term) => freq.get(term)!);

  // L2-normalize so cosine similarity = dot product
  const magnitude = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0));
  const vector = magnitude > 0 ? raw.map((v) => v / magnitude) : raw;

  return { vocab, vector };
}

/**
 * Cosine similarity between two images with potentially different vocabularies.
 * Aligns vectors on the union of both vocabularies before computing the dot product.
 */
export function cosineSimilarity(
  vocabA: string[],
  vectorA: number[],
  vocabB: string[],
  vectorB: number[]
): number {
  if (vectorA.length === 0 || vectorB.length === 0) return 0;

  // Build lookup for B
  const bMap = new Map<string, number>();
  vocabB.forEach((term, i) => bMap.set(term, vectorB[i]));

  // Dot product on shared terms (other terms contribute 0)
  let dot = 0;
  for (let i = 0; i < vocabA.length; i++) {
    const bVal = bMap.get(vocabA[i]);
    if (bVal !== undefined) {
      dot += vectorA[i] * bVal;
    }
  }

  // Vectors are already L2-normalized, so dot product = cosine similarity
  return dot;
}

export interface SimilarityResult {
  id: string;
  score: number;
}

/**
 * Find the top-K most similar images to a query image.
 *
 * @param queryVocab  - vocabulary of the query image
 * @param queryVector - embedding of the query image
 * @param candidates  - pool of images to search (each with vocab + vector + id)
 * @param topK        - number of results to return (default 5)
 * @param threshold   - minimum similarity score to include (default 0.1)
 */
export function findSimilar(
  queryVocab: string[],
  queryVector: number[],
  candidates: Array<{
    id: string;
    embeddingVocab: string[];
    embedding: number[];
  }>,
  topK = 5,
  threshold = 0.1
): SimilarityResult[] {
  const scored = candidates
    .map((c) => ({
      id: c.id,
      score: cosineSimilarity(queryVocab, queryVector, c.embeddingVocab, c.embedding),
    }))
    .filter((r) => r.score >= threshold);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
