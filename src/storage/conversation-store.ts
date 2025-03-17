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
 * Helper function to serialize a message for storage
 */
function serializeMessage(message: any) {
  // Don't just use JSON.stringify on the whole message, as it won't properly handle methods and complex objects
  try {
    // Extract the important properties
    const type =
      typeof message._getType === "function" ? message._getType() : "unknown";
    const content = message.content?.toString() || "";
    const additionalKwargs = message.additional_kwargs || {};

    // Add a timestamp if not present
    if (!additionalKwargs.timestamp) {
      additionalKwargs.timestamp = Date.now();
    }

    // Return a simplified object with just the necessary data
    return {
      type,
      content,
      additional_kwargs: additionalKwargs,
    };
  } catch (error) {
    logger.error({ error }, "Error serializing message");
    return {
      type: "unknown",
      content: "",
      additional_kwargs: { timestamp: Date.now() },
    };
  }
}

/**
 * Helper function to reconstruct proper Message objects from serialized data
 */
function reconstructMessages(messages: any[]) {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((msg) => {
      try {
        // Skip if message is null or undefined
        if (!msg) return null;

        // If it already has _getType as a function, return as is
        if (typeof msg._getType === "function") {
          return msg;
        }

        // Get the message type
        const type = msg.type || (msg._getType as string) || "unknown";

        // Get content and kwargs
        const content = msg.content || "";
        const additionalKwargs = msg.additional_kwargs || {};

        // If timestamp is missing, add it
        if (!additionalKwargs.timestamp) {
          additionalKwargs.timestamp = Date.now();
        }

        // Return the appropriate message type
        if (type === "human") {
          return new HumanMessage(content, additionalKwargs);
        } else if (type === "ai") {
          return new AIMessage(content, additionalKwargs);
        } else if (type === "system") {
          return new SystemMessage(content, additionalKwargs);
        }

        // Default to human message if type is unknown
        logger.warn(
          { messageType: type },
          "Unknown message type, converting to HumanMessage"
        );
        return new HumanMessage(content, additionalKwargs);
      } catch (error) {
        logger.error({ error, message: msg }, "Error reconstructing message");
        return null;
      }
    })
    .filter(Boolean); // Remove any null values
}

/**
 * Prepare a state object for storage by properly serializing each field
 */
function serializeState(state: ConversationState): any {
  return {
    conversationId: state.conversationId,
    messages: state.messages.map(serializeMessage),
    context: state.context || [],
    pending_actions: state.pending_actions || [],
  };
}

/**
 * Save conversation state to DynamoDB
 */
export async function saveConversationState(
  state: ConversationState
): Promise<void> {
  logger.debug(
    {
      conversationId: state.conversationId,
      messageCount: state.messages.length,
    },
    "Saving conversation state"
  );

  try {
    // Calculate TTL (days from now)
    const ttl = Math.floor(Date.now() / 1000) + CONVERSATION_TTL_DAYS * 86400;

    // Properly serialize the state to handle LangChain message objects
    const serializedState = serializeState(state);

    const storedState: StoredConversationState = {
      id: state.conversationId,
      state: JSON.stringify(serializedState),
      lastUpdated: new Date().toISOString(),
      ttl,
    };

    await putItem(TABLE_NAME, storedState);

    logger.debug(
      {
        conversationId: state.conversationId,
        messageCount: state.messages.length,
        context: state.context.length,
        pendingActions: state.pending_actions.length,
      },
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
      const serializedState = JSON.parse(storedState.state);

      // Reconstruct full state with proper message objects
      const parsedState: ConversationState = {
        conversationId: serializedState.conversationId || conversationId,
        messages: reconstructMessages(serializedState.messages || []),
        context: serializedState.context || [],
        pending_actions: serializedState.pending_actions || [],
      };

      // Log message types for debugging
      const messageTypes = parsedState.messages.map((m) =>
        typeof m._getType === "function" ? m._getType() : "unknown"
      );

      logger.debug(
        {
          conversationId,
          messageCount: parsedState.messages.length,
          messageTypes,
        },
        "Conversation state loaded successfully"
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
    logger.debug(
      {
        conversationId: id,
        messageCount: existingState.messages.length,
        contextCount: existingState.context.length,
        pendingActionsCount: existingState.pending_actions.length,
      },
      "Retrieved existing conversation state"
    );

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
