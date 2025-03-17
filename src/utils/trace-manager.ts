import { createLogger } from "./logger";

const logger = createLogger("trace-manager");

// Trace options type
interface TraceOptions {
  runId?: string;
  parentRunId?: string;
  metadata?: Record<string, any>;
}

/**
 * Manage tracing for langchain runs
 * This is a simplified version that works without requiring langsmith
 */
class TraceManager {
  private sessionMap = new Map<string, boolean>();
  private traceEnabled: boolean;

  constructor() {
    // Check if tracing is enabled in the environment
    this.traceEnabled = process.env.LANGCHAIN_TRACING !== "false";
    logger.debug(
      { tracingEnabled: this.traceEnabled },
      "Trace manager initialized"
    );
  }

  /**
   * Set up a trace session for a conversation
   */
  async setupTraceSession(conversationId: string): Promise<void> {
    if (!this.traceEnabled) return;

    try {
      // Mark this conversation as having a session
      this.sessionMap.set(conversationId, true);

      // Set environment variables for LangChain tracing
      process.env.LANGCHAIN_SESSION = conversationId;
      process.env.LANGCHAIN_PROJECT = "conversation-agent";

      logger.debug({ conversationId }, "Trace session created");
    } catch (error) {
      logger.error({ error, conversationId }, "Error creating trace session");
    }
  }

  /**
   * Run a function with tracing context
   */
  async runWithTracing<T>(
    conversationId: string,
    fn: () => Promise<T>,
    options?: TraceOptions
  ): Promise<T> {
    if (!this.traceEnabled) {
      return fn();
    }

    // If we don't have a session for this conversation, create one
    if (!this.sessionMap.has(conversationId)) {
      await this.setupTraceSession(conversationId);
    }

    try {
      // Set trace context
      if (options?.runId) {
        process.env.LANGCHAIN_RUN_ID = options.runId;
      }

      if (options?.parentRunId) {
        process.env.LANGCHAIN_PARENT_RUN_ID = options.parentRunId;
      }

      // Add metadata if available
      if (options?.metadata) {
        process.env.LANGCHAIN_METADATA = JSON.stringify(options.metadata);
      }

      // Run the function
      return await fn();
    } catch (error) {
      logger.error({ error, conversationId }, "Error in traced function");
      throw error;
    } finally {
      // Clean up
      delete process.env.LANGCHAIN_RUN_ID;
      delete process.env.LANGCHAIN_PARENT_RUN_ID;
      delete process.env.LANGCHAIN_METADATA;
    }
  }

  /**
   * End a trace session
   */
  endTraceSession(conversationId: string): void {
    if (!this.traceEnabled) return;

    this.sessionMap.delete(conversationId);

    // If this was the current session, clear it
    if (process.env.LANGCHAIN_SESSION === conversationId) {
      delete process.env.LANGCHAIN_SESSION;
    }

    logger.debug({ conversationId }, "Trace session ended");
  }
}

// Create a singleton instance
export const traceManager = new TraceManager();
