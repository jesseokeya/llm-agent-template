import { OpenAIEmbeddings } from "@langchain/openai";
import { EMBEDDING_MODEL, OPENAI_API_KEY } from "../config/env";
import { TIMEOUTS } from "../config/constants";
import { createLogger } from "../utils/logger";

const logger = createLogger("embeddings");

/**
 * Create OpenAI embeddings model with production settings
 */
export function createEmbeddings() {
  logger.debug(`Creating embeddings model: ${EMBEDDING_MODEL}`);

  return new OpenAIEmbeddings({
    openAIApiKey: OPENAI_API_KEY,
    modelName: EMBEDDING_MODEL,
    batchSize: 512, // Process 512 texts at a time for efficiency
    stripNewLines: true, // Remove newlines for better embedding quality
    maxRetries: TIMEOUTS.RETRY_ATTEMPTS,
    timeout: TIMEOUTS.VECTOR_SEARCH_TIMEOUT_MS,
  });
}

/**
 * Cache for embeddings to avoid redundant API calls
 * This is a simple in-memory cache. For production, consider Redis or another distributed cache.
 */
export class EmbeddingsCache {
  private cache = new Map<string, number[]>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(text: string): number[] | undefined {
    return this.cache.get(this.normalizeKey(text));
  }

  set(text: string, embedding: number[]): void {
    // Manage cache size - evict oldest entries if needed
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(this.normalizeKey(text), embedding);
  }

  has(text: string): boolean {
    return this.cache.has(this.normalizeKey(text));
  }

  // Normalize the text to improve cache hit rate
  private normalizeKey(text: string): string {
    return text.trim().toLowerCase();
  }

  // For monitoring/debugging
  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Create singleton cache instance
export const embeddingsCache = new EmbeddingsCache();

/**
 * Create cached embeddings model that uses the in-memory cache
 */
export function createCachedEmbeddings() {
  const baseEmbeddings = createEmbeddings();

  return {
    ...baseEmbeddings,
    embedDocuments: async (texts: string[]): Promise<number[][]> => {
      const results: number[][] = [];
      const textsToEmbed: string[] = [];
      const indices: number[] = [];

      // Check cache for each text
      texts.forEach((text, i) => {
        const cached = embeddingsCache.get(text);
        if (cached) {
          results[i] = cached;
        } else {
          textsToEmbed.push(text);
          indices.push(i);
        }
      });

      // If all embeddings were cached, return immediately
      if (textsToEmbed.length === 0) {
        return results;
      }

      // Get embeddings for texts not in cache
      const embeddings = await baseEmbeddings.embedDocuments(textsToEmbed);

      // Store in cache and add to results
      embeddings.forEach((embedding, i) => {
        const originalIndex = indices[i];
        const originalText = textsToEmbed[i];

        embeddingsCache.set(originalText, embedding);
        results[originalIndex] = embedding;
      });

      return results;
    },

    embedQuery: async (text: string): Promise<number[]> => {
      // Check cache first
      const cached = embeddingsCache.get(text);
      if (cached) {
        return cached;
      }

      // Get embedding from API
      const embedding = await baseEmbeddings.embedQuery(text);

      // Store in cache
      embeddingsCache.set(text, embedding);

      return embedding;
    },
  };
}
