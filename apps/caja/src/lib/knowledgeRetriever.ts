/**
 * Lightweight, dependency-free keyword/topic retriever (no vector DB).
 *
 * Algorithm:
 *   1. Tokenize and normalize the query (lowercase, strip accents/punctuation).
 *   2. For each entry, count how many of its keywords appear in the query
 *      (substring match first, then word-per-word fallback for phrases).
 *   3. Rank entries by number of matched keywords, descending.
 *   4. Return the top `maxResults` entries with score >= `minScore`.
 *
 * Generic: works with any corpus of `{ id, keywords }` documents, so it can
 * be reused outside the banking knowledge base.
 */

export interface RetrievableEntry {
  id: string;
  keywords: readonly string[];
}

export interface RetrievalOptions {
  /** Maximum number of top entries to return. Default: 3. */
  maxResults?: number;
  /** Minimum number of matched keywords an entry needs. Default: 1. */
  minScore?: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function retrieveKnowledge<T extends RetrievableEntry>(
  query: string,
  corpus: readonly T[],
  options: RetrievalOptions = {}
): T[] {
  const { maxResults = 3, minScore = 1 } = options;
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return [];
  }
  const queryWords = normalizedQuery.split(" ");

  const scored: Array<{ entry: T; score: number }> = [];
  for (const entry of corpus) {
    const matched = new Set<string>();
    for (const keyword of entry.keywords) {
      const normalizedKeyword = normalize(keyword);
      if (!normalizedKeyword) {
        continue;
      }
      if (normalizedQuery.includes(normalizedKeyword)) {
        matched.add(normalizedKeyword);
        continue;
      }
      // Phrase fallback: exact words appear in the query (e.g. slight
      // conjugation/word-order differences). Only for multi-word keywords.
      if (
        normalizedKeyword.includes(" ") &&
        normalizedKeyword.split(" ").every((word) => queryWords.includes(word))
      ) {
        matched.add(normalizedKeyword);
      }
    }
    if (matched.size >= minScore) {
      scored.push({ entry, score: matched.size });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map((result) => result.entry);
}