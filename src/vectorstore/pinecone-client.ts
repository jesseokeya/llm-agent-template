import { Pinecone } from "@pinecone-database/pinecone";
import {
  PINECONE_API_KEY,
  PINECONE_ENVIRONMENT,
  PINECONE_INDEX,
} from "../config/env";
import { createLogger } from "../utils/logger";

const logger = createLogger("pinecone");

// Singleton instance
let pineconeInstance: Pinecone | null = null;
let pineconeIndex: any | null = null;

/**
 * Initialize the Pinecone client with error handling and retries
 */
export async function initPinecone() {
  if (pineconeInstance) {
    return pineconeInstance;
  }

  logger.info("Initializing Pinecone client");

  try {
    const pineconeConfig: any = {
      apiKey: PINECONE_API_KEY,
    };

    // Add environment if provided
    if (PINECONE_ENVIRONMENT) {
      pineconeConfig.environment = PINECONE_ENVIRONMENT;
    }

    pineconeInstance = new Pinecone(pineconeConfig);

    // Validate connection by listing indexes
    await pineconeInstance.listIndexes();

    logger.info("Pinecone client initialized successfully");
    return pineconeInstance;
  } catch (error) {
    logger.error({ error }, "Failed to initialize Pinecone client");

    throw new Error(
      `Pinecone initialization failed: ${(error as Error).message}`
    );
  }
}

/**
 * Get the Pinecone index instance
 */
export async function getPineconeIndex() {
  if (pineconeIndex) {
    return pineconeIndex;
  }

  const pinecone = await initPinecone();

  try {
    logger.info(`Getting Pinecone index: ${PINECONE_INDEX}`);

    // Get the index
    pineconeIndex = pinecone.Index(PINECONE_INDEX);

    // Validate the index by checking its stats
    const stats = await pineconeIndex.describeIndexStats();
    logger.info(
      { vectorCount: stats.totalVectorCount },
      "Pinecone index stats"
    );

    return pineconeIndex;
  } catch (error) {
    logger.error(
      { error, indexName: PINECONE_INDEX },
      "Failed to get Pinecone index"
    );
    throw new Error(
      `Failed to get Pinecone index: ${(error as Error).message}`
    );
  }
}

/**
 * Gracefully shutdown Pinecone connections
 */
export function shutdownPinecone() {
  logger.info("Shutting down Pinecone connections");

  pineconeInstance = null;
  pineconeIndex = null;
}

/**
 * Health check function for Pinecone
 */
export async function pingPinecone(): Promise<boolean> {
  try {
    const pinecone = await initPinecone();
    await pinecone.listIndexes();
    return true;
  } catch (error) {
    logger.error({ error }, "Pinecone health check failed");
    return false;
  }
}
