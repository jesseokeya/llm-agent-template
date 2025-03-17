import {
  ConversationState,
  StoredConversationState,
} from "../types/conversation";
import { DB_TABLES } from "../config/constants";
import { CONVERSATION_TTL_DAYS } from "../config/env";
import { getItem, putItem, queryItems, deleteItem } from "./dynamo-client";
import { createLogger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";

const logger = createLogger("conversation-store");
const TABLE_NAME = DB_TABLES.CONVERSATION_STATES;

/**
 * Save conversation state to DynamoDB
 */
export async function saveConversationState(
  state: ConversationState
): Promise<void> {
  logger.debug(
    { conversationId: state.conversationId },
    "Saving conversation state"
  );

  try {
    // Calculate TTL (days from now)
    const ttl = Math.floor(Date.now() / 1000) + CONVERSATION_TTL_DAYS * 86400;

    const storedState: StoredConversationState = {
      id: state.conversationId,
      state: JSON.stringify(state),
      lastUpdated: new Date().toISOString(),
      ttl,
    };

    await putItem(TABLE_NAME, storedState);

    logger.debug(
      { conversationId: state.conversationId },
      "Conversation state saved successfully"
    );
  } catch (error) {
    logger.error(
      { error, conversationId: state.conversationId },
      "Failed to save conversation state"
    );
    throw new Error(
      `Failed to save conversation state: ${(error as Error).message}`
    );
  }
}

/**
 * Helper function to reconstruct proper Message objects
 */
function reconstructMessages(messages: any[]) {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((msg) => {
      // Check what kind of message this is based on available data
      if (!msg) return null;

      // If it already has _getType as a function, return as is
      if (typeof msg._getType === "function") {
        return msg;
      }

      // Otherwise check the type from the stored data
      const type =
        msg.type ||
        (typeof msg._getType === "string" ? msg._getType : null) ||
        msg.additional_kwargs?.type ||
        "";

      const content = msg.content || "";
      const additionalKwargs = msg.additional_kwargs || {};

      // Reconstruct the appropriate message type
      if (type === "human" || type.includes("human")) {
        return new HumanMessage(content, additionalKwargs);
      } else if (type === "ai" || type.includes("ai")) {
        return new AIMessage(content, additionalKwargs);
      } else if (type === "system" || type.includes("system")) {
        return new SystemMessage(content, additionalKwargs);
      }

      // Last resort: treat as human message
      logger.warn(
        { messageType: type },
        "Unknown message type, converting to HumanMessage"
      );
      return new HumanMessage(content, additionalKwargs);
    })
    .filter(Boolean); // Remove any null messages
}

/**
 * Load conversation state from DynamoDB
 */
export async function loadConversationState(
  conversationId: string
): Promise<ConversationState | null> {
  logger.debug({ conversationId }, "Loading conversation state");

  try {
    const storedState = await getItem<StoredConversationState>(TABLE_NAME, {
      id: conversationId,
    });

    if (!storedState) {
      logger.debug({ conversationId }, "Conversation state not found");
      return null;
    }

    try {
      // Parse the stored state
      const parsedState = JSON.parse(storedState.state) as ConversationState;

      // Reconstruct message objects to ensure they have the right methods
      if (parsedState.messages) {
        parsedState.messages = reconstructMessages(parsedState.messages);
      } else {
        parsedState.messages = [];
      }

      // Ensure other fields exist
      if (!parsedState.context) parsedState.context = [];
      if (!parsedState.pending_actions) parsedState.pending_actions = [];

      logger.debug(
        {
          conversationId,
          messageCount: parsedState.messages.length,
        },
        "Conversation state loaded and reconstructed successfully"
      );

      return parsedState;
    } catch (parseError) {
      logger.error(
        { error: parseError, conversationId },
        "Failed to parse conversation state"
      );
      return null;
    }
  } catch (error) {
    logger.error(
      { error, conversationId },
      "Failed to load conversation state"
    );
    throw new Error(
      `Failed to load conversation state: ${(error as Error).message}`
    );
  }
}

/**
 * Get or create a conversation state
 */
export async function getOrCreateConversationState(
  conversationId?: string
): Promise<ConversationState> {
  const id = conversationId || `conv_${uuidv4()}`;

  // Try to load existing state
  const existingState = conversationId
    ? await loadConversationState(conversationId)
    : null;

  if (existingState) {
    return existingState;
  }

  // Create new state
  logger.debug({ conversationId: id }, "Creating new conversation state");

  return {
    conversationId: id,
    messages: [],
    context: [],
    pending_actions: [],
  };
}

/**
 * Delete a conversation state
 */
export async function deleteConversationState(
  conversationId: string
): Promise<void> {
  logger.debug({ conversationId }, "Deleting conversation state");

  try {
    await deleteItem(TABLE_NAME, { id: conversationId });
    logger.debug({ conversationId }, "Conversation state deleted successfully");
  } catch (error) {
    logger.error(
      { error, conversationId },
      "Failed to delete conversation state"
    );
    throw new Error(
      `Failed to delete conversation state: ${(error as Error).message}`
    );
  }
}

/**
 * Get all conversation states for a user
 */
export async function getUserConversations(
  userId: string
): Promise<StoredConversationState[]> {
  logger.debug({ userId }, "Getting user conversations");

  try {
    // Requires a GSI on userId
    const conversations = await queryItems<StoredConversationState>(
      TABLE_NAME,
      "userId = :userId",
      {},
      { ":userId": userId },
      "userId-index"
    );

    logger.debug(
      { userId, count: conversations.length },
      "Retrieved user conversations"
    );
    return conversations;
  } catch (error) {
    logger.error({ error, userId }, "Failed to get user conversations");
    throw new Error(
      `Failed to get user conversations: ${(error as Error).message}`
    );
  }
}
