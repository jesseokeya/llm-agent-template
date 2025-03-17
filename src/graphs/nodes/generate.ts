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
// import { AIMessage, BaseMessage } from "@langchain/core/messages";

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
    // Validate state has messages
    const history = getMessageHistory(state, CONVERSATION.MAX_HISTORY_LENGTH);

    // Check if we have a valid history with at least one message
    if (!history || history.length === 0) {
      logger.warn(
        { conversationId: state.conversationId },
        "No message history found"
      );
      return addAIMessage(
        state,
        "I don't see any previous messages in our conversation. How can I help you today?"
      );
    }

    // Get the last message for input
    const lastMessage = history[history.length - 1];
    if (!lastMessage || !lastMessage.content) {
      logger.warn(
        { conversationId: state.conversationId },
        "Last message is invalid"
      );
      return addAIMessage(
        state,
        "I'm having trouble understanding your last message. Could you please try again?"
      );
    }

    const formattedHistory = formatChatHistory(history);
    const context = getAllContextAsString(state);

    // Format input for the model
    const input = {
      chat_history: formattedHistory,
      context: context || "No relevant context found.",
      input: lastMessage.content.toString(),
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
    // Improved error logging
    logger.error(
      {
        error,
        errorMessage: (error as Error).message,
        errorStack: (error as Error).stack,
        conversationId: state.conversationId,
        stateInfo: {
          messageCount: state?.messages?.length || 0,
          contextCount: state?.context?.length || 0,
          pendingActionsCount: state?.pending_actions?.length || 0,
        },
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
      context: fullContext,
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
    console.log(error);
    logger.error({ error }, "Error generating response with action summary");

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
