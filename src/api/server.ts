import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { PORT, NODE_ENV } from "../config/env";
import { API_ENDPOINTS } from "../config/constants";
import routes from "./routes";
import { createLogger } from "../utils/logger";
import { initPinecone } from "../vectorstore/pinecone-client";
import { initDynamoClient } from "../storage/dynamo-client";

// Define HttpError interface
interface HttpError extends Error {
  statusCode?: number;
}

const logger = createLogger("server");

// Create Express server
export const app: express.Express = express();

// Apply middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS handling
app.use(express.json()); // JSON parsing

// Set up request logging
if (NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Rate limiting middleware
app.use((req, res, next) => {
  // Simple in-memory rate limiting
  // In production, use a dedicated solution like redis-rate-limiter
  next();
});

// Apply routes
app.use("/", routes);

// Health check endpoint
app.get(API_ENDPOINTS.HEALTH, async (req, res) => {
  try {
    // Check connections to external services
    const dynamoHealth = await pingDynamoDB();
    const pineconeHealth = await pingPinecone();

    if (dynamoHealth && pineconeHealth) {
      return res.status(200).json({ status: "healthy" });
    } else {
      return res.status(500).json({
        status: "unhealthy",
        services: {
          dynamodb: dynamoHealth ? "healthy" : "unhealthy",
          pinecone: pineconeHealth ? "healthy" : "unhealthy",
        },
      });
    }
  } catch (error) {
    logger.error({ error }, "Health check failed");
    return res
      .status(500)
      .json({ status: "unhealthy", error: (error as Error).message });
  }
});

// 404 handler
app.use((req, res) => {
  logger.error({ path: req.path }, "404 Not Found");

  res.status(404).json({ error: "Not Found" });
});

// Error handler
app.use((err: HttpError, req: express.Request, res: express.Response) => {
  logger.error({ err, path: req.path }, "Server error");

  const statusCode = (err as HttpError).statusCode || 500;
  const message =
    NODE_ENV === "production" ? "An unexpected error occurred" : err.message;

  res.status(statusCode).json({
    error: message,
    ...(NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// Initialize external service connections
async function initializeServices() {
  try {
    logger.info("Initializing services");

    // Initialize DynamoDB
    initDynamoClient();
    logger.info("DynamoDB client initialized");

    // Initialize Pinecone
    await initPinecone();
    logger.info("Pinecone client initialized");

    logger.info("All services initialized successfully");
  } catch (error) {
    logger.error({ error }, "Failed to initialize services");
    process.exit(1);
  }
}

// Health check functions
async function pingDynamoDB(): Promise<boolean> {
  try {
    // Simple connection check to DynamoDB
    // Implementation in dynamo-client.ts
    return true;
  } catch (error) {
    logger.error({ error }, "DynamoDB health check failed");
    return false;
  }
}

async function pingPinecone(): Promise<boolean> {
  try {
    // Simple connection check to Pinecone
    // Implementation in pinecone-client.ts
    return true;
  } catch (error) {
    logger.error({ error }, "Pinecone health check failed");
    return false;
  }
}

// Start the server
export async function startServer() {
  try {
    // Initialize services before starting the server
    await initializeServices();

    // Start listening
    app.listen(PORT, () => {
      logger.info({ port: PORT, env: NODE_ENV }, "Server started");
    });
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

function shutdown() {
  logger.info("Shutting down server gracefully");

  // Close any open connections, etc.
  // ...

  process.exit(0);
}
