import { startServer } from "./api/server";
import { startActionProcessor } from "./workers/action-processor";
import { createLogger } from "./utils/logger";
import { NODE_ENV } from "./config/env";

const logger = createLogger("app");

async function main() {
  logger.info({ env: NODE_ENV }, "Starting application");

  try {
    // Start the API server
    await startServer();

    // Start the action processor worker
    // This runs in the same process for simplicity
    // In production, you'd run this as a separate service.
    if (NODE_ENV !== "test") {
      startActionProcessor(10, 5000).catch((error) => {
        logger.error({ error }, "Error in action processor");
      });
    }

    logger.info("Application started successfully");
  } catch (error) {
    logger.fatal({ error }, "Failed to start application");
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught exception");
  process.exit(1);
});

// Handle unhandled rejections
process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled promise rejection");
  process.exit(1);
});

// Start the application
main().catch((error) => {
  logger.fatal({ error }, "Error in main application");
  process.exit(1);
});
