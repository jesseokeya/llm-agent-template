import { Document } from "@langchain/core/documents";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex } from "./pinecone-client";
import { createCachedEmbeddings } from "../models/embeddings";
import { CONVERSATION } from "../config/constants";
import { createLogger } from "../utils/logger";
import { ContextChunk } from "../types/conversation";

const logger = createLogger("vectorstore");

// Cache for vector store instances to avoid recreation
const vectorStoreCache = new Map<string, PineconeStore>();

/**
 * Create a vector store with the specified namespace
 */
export async function createVectorStore(
  namespace?: string
): Promise<PineconeStore> {
  const cacheKey = namespace || "default";

  // Check cache first
  if (vectorStoreCache.has(cacheKey)) {
    return vectorStoreCache.get(cacheKey)!;
  }

  logger.debug(
    `Creating vector store with namespace: ${namespace || "default"}`
  );

  try {
    const pineconeIndex = await getPineconeIndex();
    const embeddings = createCachedEmbeddings();

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      namespace,
      textKey: "text",
      filter: {}, // Default empty filter
    });

    // Cache the instance
    vectorStoreCache.set(cacheKey, vectorStore);

    return vectorStore;
  } catch (error) {
    logger.error({ error, namespace }, "Failed to create vector store");
    throw new Error(
      `Failed to create vector store: ${(error as Error).message}`
    );
  }
}

/**
 * Add documents to the vector store
 */
export async function addDocuments(
  docs: Document[],
  namespace?: string
): Promise<void> {
  if (!docs.length) {
    logger.warn("No documents to add to vector store");
    return;
  }

  logger.info(
    { count: docs.length, namespace },
    "Adding documents to vector store"
  );

  try {
    const vectorStore = await createVectorStore(namespace);
    await vectorStore.addDocuments(docs);

    logger.info(
      { count: docs.length },
      "Successfully added documents to vector store"
    );
  } catch (error) {
    logger.error(
      { error, count: docs.length },
      "Failed to add documents to vector store"
    );
    throw new Error(
      `Failed to add documents to vector store: ${(error as Error).message}`
    );
  }
}

/**
 * Query the vector store for similar documents
 */
export async function querySimilarDocuments(
  query: string,
  k = CONVERSATION.DEFAULT_RETRIEVAL_LIMIT,
  namespace?: string,
  filter?: Record<string, any>
): Promise<ContextChunk[]> {
  logger.debug(
    { query, k, namespace },
    "Querying vector store for similar documents"
  );

  try {
    const vectorStore = await createVectorStore(namespace);

    // Use vector store's similarity search
    const documents = await vectorStore.similaritySearch(query, k, filter);

    // Format the results into ContextChunks
    const contextChunks: ContextChunk[] = documents.map((doc) => ({
      content: doc.pageContent,
      metadata: doc.metadata,
    }));

    logger.debug(
      { count: contextChunks.length },
      "Retrieved similar documents"
    );
    return contextChunks;
  } catch (error) {
    logger.error({ error, query }, "Failed to query vector store");
    throw new Error(
      `Failed to query vector store: ${(error as Error).message}`
    );
  }
}

/**
 * Create a retriever function from the vector store
 */
export async function createRetriever(
  k = CONVERSATION.DEFAULT_RETRIEVAL_LIMIT,
  namespace?: string
) {
  const vectorStore = await createVectorStore(namespace);
  return vectorStore.asRetriever(k);
}

/**
 * Clear caches and connections
 */
export function clearVectorStoreCache() {
  vectorStoreCache.clear();
}
