import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ConversationState } from "../types/conversation";
import { CONVERSATION } from "../config/constants";
import { createLogger } from "../utils/logger";

const logger = createLogger("memory");

/**
 * Add a human message to conversation state
 */
export function addHumanMessage(
  state: ConversationState,
  content: string
): ConversationState {
  logger.debug(
    {
      conversationId: state.conversationId,
      messageCount: state.messages.length,
    },
    "Adding human message"
  );

  if (!content || content.trim() === "") {
    logger.warn("Attempted to add empty human message, ignoring");
    return state;
  }

  // Create a new message with timestamp
  const message = new HumanMessage(content, {
    timestamp: Date.now(),
  });

  return {
    ...state,
    messages: [...state.messages, message],
  };
}

/**
 * Add an AI message to conversation state
 */
export function addAIMessage(
  state: ConversationState,
  content: string
): ConversationState {
  logger.debug(
    {
      conversationId: state.conversationId,
      messageCount: state.messages.length,
    },
    "Adding AI message"
  );

  if (!content || content.trim() === "") {
    logger.warn("Attempted to add empty AI message, ignoring");
    return state;
  }

  // Create a new message with timestamp
  const message = new AIMessage(content, {
    timestamp: Date.now(),
  });

  return {
    ...state,
    messages: [...state.messages, message],
  };
}

/**
 * Add a system message to conversation state
 */
export function addSystemMessage(
  state: ConversationState,
  content: string
): ConversationState {
  logger.debug(
    {
      conversationId: state.conversationId,
    },
    "Adding system message"
  );

  if (!content || content.trim() === "") {
    logger.warn("Attempted to add empty system message, ignoring");
    return state;
  }

  // Create a new message with timestamp
  const message = new SystemMessage(content, {
    timestamp: Date.now(),
  });

  return {
    ...state,
    messages: [...state.messages, message],
  };
}

/**
 * Get limited message history for context window management
 */
export function getMessageHistory(
  state: ConversationState,
  limit = CONVERSATION.MAX_HISTORY_LENGTH
) {
  // Validate the conversation state
  if (!state || !Array.isArray(state.messages)) {
    logger.warn("Invalid conversation state or messages array");
    return [];
  }

  // Filter out any invalid messages
  const validMessages = state.messages.filter((msg) => {
    return msg && (typeof msg._getType === "function" || msg.content);
  });

  // If there are no valid messages, return empty array
  if (validMessages.length === 0) {
    return [];
  }

  // If there are fewer messages than the limit, return all valid messages
  if (validMessages.length <= limit) {
    return validMessages;
  }

  // Otherwise, return the most recent messages up to the limit
  return validMessages.slice(-limit);
}

/**
 * Get formatted message history as a string
 */
export function getFormattedMessageHistory(
  state: ConversationState,
  limit = CONVERSATION.MAX_HISTORY_LENGTH
): string {
  const messages = getMessageHistory(state, limit);

  return messages
    .map((message) => {
      try {
        const role =
          typeof message._getType === "function"
            ? message._getType()
            : "unknown";

        const content = message.content?.toString() || "";

        return `${
          role === "human" ? "Human" : role === "ai" ? "Assistant" : "System"
        }: ${content}`;
      } catch (error) {
        logger.error({ error }, "Error formatting message");
        return "";
      }
    })
    .filter((msg) => msg) // Remove empty messages
    .join("\n\n");
}

/**
 * Clear conversation history
 */
export function clearConversationHistory(
  state: ConversationState
): ConversationState {
  logger.debug(
    { conversationId: state.conversationId },
    "Clearing conversation history"
  );

  return {
    ...state,
    messages: [],
  };
}

/**
 * Summarize conversation history to manage context window
 * This is useful when the conversation is too long and we need to compress it
 */
export async function summarizeConversationHistory(
  state: ConversationState,
  summarizer: (history: string) => Promise<string>
): Promise<ConversationState> {
  logger.debug(
    { conversationId: state.conversationId },
    "Summarizing conversation history"
  );

  // If there aren't enough messages to summarize, return the state as is
  if (state.messages.length <= CONVERSATION.MAX_HISTORY_LENGTH) {
    return state;
  }

  // Format history for summarization
  const formattedHistory = getFormattedMessageHistory(
    state,
    state.messages.length
  );

  // Get summary
  const summary = await summarizer(formattedHistory);

  // Create a new state with the summarized history as a system message
  // and the most recent messages
  const recentMessages = state.messages.slice(
    -Math.floor(CONVERSATION.MAX_HISTORY_LENGTH / 2)
  );

  return {
    ...state,
    messages: [
      new SystemMessage(`Previous conversation summary: ${summary}`, {
        timestamp: Date.now(),
      }),
      ...recentMessages,
    ],
  };
}
