import { BaseMessage } from "@langchain/core/messages";
import { ConversationState, PendingAction } from "../types/conversation";
import { v4 as uuidv4 } from "uuid";

/**
 * Initial state for a new conversation
 */
export const initialState: ConversationState = {
  conversationId: `conv_${uuidv4()}`,
  messages: [],
  context: [],
  pending_actions: [],
};

/**
 * State reducer functions for conversation graph
 */

/**
 * Add a message to the conversation state
 */
export function addMessage(
  state: ConversationState,
  message: BaseMessage
): ConversationState {
  return {
    ...state,
    messages: [...state.messages, message],
  };
}

/**
 * Add context to the conversation state
 */
export function addContext(
  state: ConversationState,
  context: string
): ConversationState {
  return {
    ...state,
    context: [...state.context, context],
  };
}

/**
 * Set the entire context array
 */
export function setContext(
  state: ConversationState,
  context: string[]
): ConversationState {
  return {
    ...state,
    context,
  };
}

/**
 * Add an action to the conversation state
 */
export function addAction(
  state: ConversationState,
  action: PendingAction
): ConversationState {
  return {
    ...state,
    pending_actions: [...state.pending_actions, action],
  };
}

/**
 * Update an action in the conversation state
 */
export function updateAction(
  state: ConversationState,
  actionId: string,
  updates: Partial<PendingAction>
): ConversationState {
  return {
    ...state,
    pending_actions: state.pending_actions.map((action) =>
      action.id === actionId ? { ...action, ...updates } : action
    ),
  };
}

/**
 * Clear actions from the conversation state
 */
export function clearActions(state: ConversationState): ConversationState {
  return {
    ...state,
    pending_actions: [],
  };
}

/**
 * Helper function to extract the last message
 */
export function getLastMessage(
  state: ConversationState
): BaseMessage | undefined {
  if (state.messages.length === 0) {
    return undefined;
  }
  return state.messages[state.messages.length - 1];
}

/**
 * Helper function to extract the last human message
 */
export function getLastHumanMessage(
  state: ConversationState
): BaseMessage | undefined {
  // Iterate backward to find the last human message
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const message = state.messages[i];
    if (message._getType() === "human") {
      return message;
    }
  }
  return undefined;
}

/**
 * Helper function to extract all context as a string
 */
export function getAllContextAsString(state: ConversationState): string {
  return state.context.join("\n\n");
}
