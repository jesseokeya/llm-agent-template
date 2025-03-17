import { ConversationState } from "../../types/conversation";
import {
  createChatModel,
  createRagPrompt,
  formatChatHistory,
} from "../../models/llm";
import { addAIMessage } from "../../conversation/memory";
import { getMessageHistory } from "../../conversation/memory";
import { getAllContextAsString } from "../state";
import { createLogger } from "../../utils/logger";
import { CONVERSATION } from "../../config/constants";

const logger = createLogger("generate");

// Initialize models
const chatModel = createChatModel();
const ragPrompt = createRagPrompt();

/**
 * Response generation node for LangGraph
 *
 * This node generates an AI response based on the conversation context and history.
 */
export async function generateResponseNode(
  state: ConversationState
): Promise<ConversationState> {
  logger.debug({ conversationId: state.conversationId }, "Generating response");

  try {
    // Get history and context
    const history = getMessageHistory(state, CONVERSATION.MAX_HISTORY_LENGTH);

    // If no valid history is found, return a default response
    if (!history || history.length === 0) {
      logger.warn(
        { conversationId: state.conversationId },
        "No valid message history found"
      );
      return addAIMessage(
        state,
        "I don't see any previous messages. How can I help you today?"
      );
    }

    const formattedHistory = formatChatHistory(history);
    const context = getAllContextAsString(state);

    // Format input for the model
    const input = {
      chat_history: formattedHistory,
      context: context || "No relevant context found.",
      input: history[history.length - 1].content,
    };

    // Generate response
    logger.debug(
      { conversationId: state.conversationId },
      "Calling LLM for response"
    );

    // Use type assertions to bypass type checking
    const chain = ragPrompt.pipe(chatModel as any);
    const response: any = await (chain as any).invoke(input);

    const responseContent = response.content;

    logger.info(
      { conversationId: state.conversationId },
      "Response generated successfully"
    );

    // Add the response to the conversation
    return addAIMessage(state, responseContent as string);
  } catch (error) {
    logger.error(
      {
        error,
        errorMessage: (error as Error).message,
        conversationId: state.conversationId,
        messageCount: state.messages?.length || 0,
      },
      "Error generating response"
    );

    // Return a fallback response in case of error
    return addAIMessage(
      state,
      "I apologize, but I'm having trouble generating a response right now. Please try again in a moment."
    );
  }
}

/**
 * Specialized response generation node that also summarizes action results
 */
export async function generateResponseWithActionSummaryNode(
  state: ConversationState
): Promise<ConversationState> {
  logger.debug(
    { conversationId: state.conversationId },
    "Generating response with action summary"
  );

  try {
    // Get history and context
    const history = getMessageHistory(state, CONVERSATION.MAX_HISTORY_LENGTH);

    // If no valid history is found, return a default response
    if (!history || history.length === 0) {
      logger.warn(
        { conversationId: state.conversationId },
        "No valid message history found"
      );
      return addAIMessage(
        state,
        "I don't see any previous messages. How can I help you today?"
      );
    }

    const formattedHistory = formatChatHistory(history);
    const context = getAllContextAsString(state);

    // Create action summary
    const completedActions = state.pending_actions.filter(
      (a) => a.status === "completed"
    );
    const failedActions = state.pending_actions.filter(
      (a) => a.status === "failed"
    );

    let actionSummary = "";

    if (completedActions.length > 0) {
      actionSummary += "Completed actions:\n";
      completedActions.forEach((action) => {
        actionSummary += `- ${action.type}: ${JSON.stringify(action.data)}\n`;
      });
    }

    if (failedActions.length > 0) {
      actionSummary += "\nFailed actions:\n";
      failedActions.forEach((action) => {
        actionSummary += `- ${action.type}: ${JSON.stringify(action.data)}\n`;
      });
    }

    // Add the action summary to the context
    const fullContext = context
      ? `${context}\n\nAction summary:\n${actionSummary}`
      : `Action summary:\n${actionSummary}`;

    // Format input for the model
    const input = {
      chat_history: formattedHistory,
      context: fullContext || "No relevant context found.",
      input: history[history.length - 1].content,
    };

    // Generate response
    logger.debug(
      { conversationId: state.conversationId },
      "Calling LLM for response"
    );

    // Use type assertions to bypass type checking
    const chain = ragPrompt.pipe(chatModel as any);
    const response: any = await (chain as any).invoke(input);

    // Add the response to the conversation
    return addAIMessage(state, response.content as string);
  } catch (error) {
    logger.error(
      {
        error,
        errorMessage: (error as Error).message,
        conversationId: state.conversationId,
        messageCount: state.messages?.length || 0,
      },
      "Error generating response with action summary"
    );

    // Return a fallback response
    return addAIMessage(
      state,
      "I apologize, but I'm having trouble generating a response right now. Please try again."
    );
  }
}

/**
 * Create a specialized response generator with custom prompt
 */
export function createCustomResponseGenerator(systemPrompt: string) {
  return async (state: ConversationState): Promise<ConversationState> => {
    try {
      // Create a custom prompt with the provided system prompt
      const customPrompt = createRagPrompt();

      // Get history and context
      const history = getMessageHistory(state);
      const formattedHistory = formatChatHistory(history);
      const context = getAllContextAsString(state);

      // Format input for the model
      const input = {
        chat_history: formattedHistory,
        context: context || "No relevant context found.",
        input: history[history.length - 1].content,
        system_prompt: systemPrompt,
      };

      // Generate response
      logger.debug(
        { conversationId: state.conversationId },
        "Calling LLM for response"
      );

      // Use type assertions to bypass type checking
      const chain = customPrompt.pipe(chatModel as any);
      const response: any = await (chain as any).invoke(input);

      // Add the response to the conversation
      return addAIMessage(state, response.content as string);
    } catch (error) {
      logger.error({ error }, "Error in custom response generator");

      // Return a fallback response
      return addAIMessage(
        state,
        "I apologize, but I'm having trouble generating a response right now."
      );
    }
  };
}
