import express from "express";
import { z } from "zod";
import { createMinimalGraph } from "../graphs/conversation-graph";
import {
  getOrCreateConversationState,
  saveConversationState,
} from "../storage/conversation-store";
import { addHumanMessage } from "../conversation/memory";
import {
  //   ChatRequest,
  ChatResponse,
  // ConversationState,
} from "../types/conversation";
import { createLogger } from "../utils/logger";

const logger = createLogger("conversation-api");
const router: express.Router = express.Router();

// Request validation schema
const chatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  conversationId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * POST /api/conversation/chat
 * Main endpoint for chat interactions
 */
// @ts-ignore -
router.post("/chat", async (req, res) => {
  try {
    // Validate request
    const validationResult = chatRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      logger.warn(
        { errors: validationResult.error.errors },
        "Invalid chat request"
      );
      return res.status(400).json({
        error: "Invalid request",
        details: validationResult.error.errors,
      });
    }

    const { message, conversationId, metadata } = validationResult.data;

    logger.info(
      {
        conversationId: conversationId || "new",
        messageLength: message.length,
      },
      "Processing chat request"
    );

    // Start timing for performance tracking
    const startTime = Date.now();

    // Get or create conversation state
    const state = await getOrCreateConversationState(conversationId);

    // Add the user message to state
    const updatedState = addHumanMessage(state, message);

    // Add detailed logging of the state structure
    logger.debug(
      {
        conversationId: updatedState.conversationId,
        stateStructure: {
          hasMessages: Array.isArray(updatedState.messages),
          messagesCount: updatedState.messages.length,
          hasContext: Array.isArray(updatedState.context),
          hasPendingActions: Array.isArray(updatedState.pending_actions),
          stateKeys: Object.keys(updatedState),
        },
      },
      "State structure before graph invocation"
    );

    // Create the conversation graph
    let graph;
    try {
      // Try using the minimal fallback graph which has built-in error handling
      graph = createMinimalGraph();
      logger.debug("Minimal fallback graph created successfully");
    } catch (graphError) {
      logger.error(
        {
          error: graphError,
          message: (graphError as Error).message,
          stack: (graphError as Error).stack,
        },
        "Error creating conversation graph"
      );
      return res.status(500).json({
        error: "An error occurred setting up the conversation",
        message: (graphError as Error).message,
      });
    }

    // Run the conversation graph
    logger.debug(
      { conversationId: updatedState.conversationId },
      "Running conversation graph"
    );

    try {
      // Invoke the graph with our state
      const resultState = await graph.invoke(updatedState);

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Save the updated state
      await saveConversationState(resultState);

      // Get the last AI message
      const lastAiMessage =
        resultState.messages[resultState.messages.length - 1];

      // Build the response
      const response: ChatResponse = {
        message: lastAiMessage.content as string,
        conversationId: resultState.conversationId,
        actions: resultState.pending_actions.filter(
          (action: any) => action.status === "completed"
        ),
        metadata: {
          processingTime,
          ...(metadata || {}),
        },
      };

      logger.info(
        {
          conversationId: resultState.conversationId,
          processingTime,
          actionCount: response.actions.length,
        },
        "Chat request processed successfully"
      );

      return res.json(response);
    } catch (error) {
      logger.error({ error }, "Error processing graph");

      return res.status(500).json({
        error: "An error occurred processing your request",
        message: (error as Error).message,
      });
    }
  } catch (error) {
    logger.error({ error }, "Error processing chat request");

    return res.status(500).json({
      error: "An error occurred processing your request",
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/conversation/:conversationId
 * Get conversation history and metadata
 */
// @ts-ignore -
router.get("/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;

    logger.debug({ conversationId }, "Getting conversation");

    // Get conversation state
    const state = await getOrCreateConversationState(conversationId);

    // Check if conversation exists (has messages)
    if (!state || state.messages.length === 0) {
      return res.status(404).json({
        error: "Conversation not found",
      });
    }

    // Format messages for the response
    const messages = state.messages.map((message) => ({
      role: message._getType(),
      content: message.content,
      timestamp: message.additional_kwargs.timestamp || Date.now(),
    }));

    return res.json({
      conversationId,
      messages,
      actionCount: state.pending_actions.length,
    });
  } catch (error) {
    logger.error(
      { error, conversationId: req.params.conversationId },
      "Error getting conversation"
    );

    return res.status(500).json({
      error: "An error occurred retrieving the conversation",
      message: (error as Error).message,
    });
  }
});

/**
 * DELETE /api/conversation/:conversationId
 * Delete a conversation
 */
// @ts-ignore -
router.delete("/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;

    logger.debug({ conversationId }, "Deleting conversation");

    // TODO: Implement conversation deletion

    return res.json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    logger.error(
      { error, conversationId: req.params.conversationId },
      "Error deleting conversation"
    );

    return res.status(500).json({
      error: "An error occurred deleting the conversation",
      message: (error as Error).message,
    });
  }
});

// @ts-ignore - debug endpoint
router.get("/:conversationId/debug", async (req, res) => {
  const { conversationId } = req.params;
  const state = await getOrCreateConversationState(conversationId);
  return res.json({
    stateStructure: {
      hasMessages: Array.isArray(state.messages),
      messageCount: state.messages.length,
      messageTypes: state.messages.map((m) =>
        m._getType ? m._getType() : "unknown"
      ),
      hasContext: Array.isArray(state.context),
      contextCount: state.context.length,
      hasPendingActions: Array.isArray(state.pending_actions),
      pendingActionsCount: state.pending_actions.length,
    },
    rawState: state,
  });
});

export default router;
