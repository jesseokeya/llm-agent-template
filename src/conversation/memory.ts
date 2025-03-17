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
    { conversationId: state.conversationId },
    "Adding human message"
  );

  return {
    ...state,
    messages: [...state.messages, new HumanMessage(content)],
  };
}

/**
 * Add an AI message to conversation state
 */
export function addAIMessage(
  state: ConversationState,
  content: string
): ConversationState {
  logger.debug({ conversationId: state.conversationId }, "Adding AI message");

  return {
    ...state,
    messages: [...state.messages, new AIMessage(content)],
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
    { conversationId: state.conversationId },
    "Adding system message"
  );

  return {
    ...state,
    messages: [...state.messages, new SystemMessage(content)],
  };
}

/**
 * Get limited message history for context window management
 */
export function getMessageHistory(
  state: ConversationState,
  limit = CONVERSATION.MAX_HISTORY_LENGTH
) {
  // If there are fewer messages than the limit, return all messages
  if (state.messages.length <= limit) {
    return state.messages;
  }

  // Otherwise, return the most recent messages up to the limit
  return state.messages.slice(-limit);
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
      const role = message._getType();
      const content = message.content;
      return `${
        role === "human" ? "Human" : role === "ai" ? "Assistant" : "System"
      }: ${content}`;
    })
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
      new SystemMessage(`Previous conversation summary: ${summary}`),
      ...recentMessages,
    ],
  };
}
