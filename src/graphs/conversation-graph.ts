import { ConversationState } from "../types/conversation";
// import { initialState } from "./state";
import { retrievalNode } from "./nodes/retrieval";
import { extractActionsNode } from "./nodes/extract-actions";
import { executeActionsNode } from "./nodes/execute-actions";
import {
  generateResponseNode,
  generateResponseWithActionSummaryNode,
} from "./nodes/generate";
import { createLogger } from "../utils/logger";
import { AIMessage } from "@langchain/core/messages";

const logger = createLogger("conversation-graph");

/**
 * Create the main conversation graph
 */
export function createConversationGraph() {
  logger.debug("Creating conversation graph");

  try {
    return {
      invoke: async (state: ConversationState) => {
        logger.debug("Running full conversation graph");

        try {
          // Run nodes in sequence
          let currentState = state;

          // Retrieval step
          currentState = await retrievalNode(currentState);

          // Extract actions step
          currentState = await extractActionsNode(currentState);

          // Execute actions step
          currentState = await executeActionsNode(currentState);

          // Generate response with action summary
          currentState = await generateResponseWithActionSummaryNode(
            currentState
          );

          logger.debug("Conversation graph completed successfully");
          return currentState;
        } catch (error) {
          logger.error(
            { error, message: (error as Error).message },
            "Error in conversation graph"
          );
          return createFallbackResponse(state);
        }
      },
    };
  } catch (error) {
    logger.error(
      { error, message: (error as Error).message },
      "Error creating conversation graph"
    );
    return createFallbackGraph();
  }
}

/**
 * Create a simpler RAG-only conversation graph
 */
export function createRagOnlyGraph() {
  logger.debug("Creating RAG-only conversation graph");

  try {
    return {
      invoke: async (state: ConversationState) => {
        logger.debug("Running RAG-only conversation graph");

        try {
          // Run nodes in sequence
          let currentState = state;

          // Retrieval step
          currentState = await retrievalNode(currentState);

          // Generate response
          currentState = await generateResponseNode(currentState);

          logger.debug("RAG-only graph completed successfully");
          return currentState;
        } catch (error) {
          logger.error(
            { error, message: (error as Error).message },
            "Error in RAG-only graph"
          );
          return createFallbackResponse(state);
        }
      },
    };
  } catch (error) {
    logger.error(
      { error, message: (error as Error).message },
      "Error creating RAG-only graph"
    );
    return createFallbackGraph();
  }
}

/**
 * Create a minimal graph with just the generate response node
 * Used for simple use cases or when other components aren't needed
 */
export function createMinimalGraph() {
  logger.debug("Creating minimal conversation graph");

  try {
    return {
      invoke: async (state: ConversationState) => {
        logger.debug("Running minimal conversation graph");

        try {
          // Run the generate response node directly
          const result = await generateResponseNode(state);
          logger.debug("Minimal graph completed successfully");
          return result;
        } catch (error) {
          logger.error(
            { error, message: (error as Error).message },
            "Error in minimal graph"
          );
          return createFallbackResponse(state);
        }
      },
    };
  } catch (error) {
    logger.error(
      { error, message: (error as Error).message },
      "Error creating minimal graph"
    );
    return createFallbackGraph();
  }
}

/**
 * Create a graph with conditional branching based on action presence
 */
export function createAdvancedConversationGraph() {
  logger.debug("Creating advanced conversation graph");

  try {
    return {
      invoke: async (state: ConversationState) => {
        logger.debug("Running advanced conversation graph");

        try {
          // Run nodes in sequence with conditional branching
          let currentState = state;

          // Retrieval step
          currentState = await retrievalNode(currentState);

          // Extract actions step
          currentState = await extractActionsNode(currentState);

          // Conditional branching based on detected actions
          if (currentState.pending_actions.length > 0) {
            // Execute actions if any were found
            currentState = await executeActionsNode(currentState);

            // Generate response with action summary
            currentState = await generateResponseWithActionSummaryNode(
              currentState
            );
          } else {
            // Generate standard response if no actions
            currentState = await generateResponseNode(currentState);
          }

          logger.debug("Advanced conversation graph completed successfully");
          return currentState;
        } catch (error) {
          logger.error(
            { error, message: (error as Error).message },
            "Error in advanced conversation graph"
          );
          return createFallbackResponse(state);
        }
      },
    };
  } catch (error) {
    logger.error(
      { error, message: (error as Error).message },
      "Error creating advanced conversation graph"
    );
    return createFallbackGraph();
  }
}

/**
 * Helper to create a fallback response when a node fails
 */
function createFallbackResponse(state: ConversationState): ConversationState {
  return {
    ...state,
    messages: [
      ...state.messages,
      new AIMessage({
        content: "I'm sorry, I encountered an error processing your request.",
        additional_kwargs: { timestamp: Date.now() },
      }),
    ],
  };
}

/**
 * Create a basic fallback graph that will always work
 * Used when other graphs fail to initialize
 */
function createFallbackGraph() {
  logger.warn("Creating fallback graph due to initialization errors");

  return {
    invoke: async (state: ConversationState) => {
      try {
        // Try to use retrieval and generate nodes directly if possible
        let updatedState = state;

        try {
          updatedState = await retrievalNode(state);
        } catch (e) {
          logger.error({ error: e }, "Error in fallback retrieval");
        }

        try {
          updatedState = await generateResponseNode(updatedState);
        } catch (e) {
          logger.error({ error: e }, "Error in fallback generation");

          // If all else fails, add a manual response
          if (
            !updatedState.messages ||
            updatedState.messages.length === 0 ||
            updatedState.messages[
              updatedState.messages.length - 1
            ]._getType() !== "ai"
          ) {
            updatedState = {
              ...updatedState,
              messages: [
                ...(updatedState.messages || []),
                new AIMessage({
                  content:
                    "I apologize, but I'm having trouble processing your request right now. Our system is operating in fallback mode.",
                  additional_kwargs: { timestamp: Date.now() },
                }),
              ],
            };
          }
        }

        return updatedState;
      } catch (error) {
        logger.error({ error }, "Critical error in fallback graph");

        // Emergency recovery - return a basic response
        return {
          ...state,
          messages: [
            ...(state.messages || []),
            new AIMessage({
              content:
                "I'm sorry, I'm having technical difficulties. Please try again later.",
              additional_kwargs: { timestamp: Date.now() },
            }),
          ],
        };
      }
    },
  };
}
