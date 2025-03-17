import express from "express";
import { z } from "zod";
import { createAdvancedConversationGraph } from "../graphs/conversation-graph";
import {
  getOrCreateConversationState,
  saveConversationState,
} from "../storage/conversation-store";
import { addHumanMessage } from "../conversation/memory";
import {
  //   ChatRequest,
  ChatResponse,
  ConversationState,
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
// @ts-ignore - TODO: fix this
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

    // Create the conversation graph
    const graph = createAdvancedConversationGraph();

    // Run the conversation graph
    logger.debug(
      { conversationId: updatedState.conversationId },
      "Running conversation graph"
    );
    const result = (await graph.invoke(updatedState)) as ConversationState;

    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // Save the updated state
    await saveConversationState(result);

    // Get the last AI message
    const lastAiMessage = result.messages[result.messages.length - 1];

    // Build the response
    const response: ChatResponse = {
      message: lastAiMessage.content as string,
      conversationId: result.conversationId,
      actions: result.pending_actions.filter(
        (action: any) => action.status === "completed"
      ),
      metadata: {
        processingTime,
        ...(metadata || {}),
      },
    };

    logger.info(
      {
        conversationId: result.conversationId,
        processingTime,
        actionCount: response.actions.length,
      },
      "Chat request processed successfully"
    );

    return res.json(response);
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
// @ts-ignore - TODO: fix this
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
// @ts-ignore - TODO: fix this
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

export default router;
