import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { LLM_MODEL, LLM_TEMPERATURE, OPENAI_API_KEY } from "../config/env";
import { SYSTEM_MESSAGES, TIMEOUTS } from "../config/constants";
import { createLogger } from "../utils/logger";
import { BaseMessage } from "@langchain/core/messages";

const logger = createLogger("llm");

/**
 * Create a standard chat model with optimal settings
 */
export function createChatModel() {
  logger.debug(
    `Creating chat model with: ${LLM_MODEL}, temp: ${LLM_TEMPERATURE}`
  );

  return new ChatOpenAI({
    openAIApiKey: OPENAI_API_KEY,
    modelName: LLM_MODEL,
    temperature: LLM_TEMPERATURE,
    timeout: TIMEOUTS.LLM_REQUEST_TIMEOUT_MS,
    maxRetries: TIMEOUTS.RETRY_ATTEMPTS,
  });
}

/**
 * Create a function-calling enabled model with the provided functions
 * This uses the newer OpenAI tools format
 */
export function createFunctionCallingModel(tools: any[]) {
  logger.debug(`Creating function calling model with ${tools.length} tools`);

  // Create basic model
  const model = new ChatOpenAI({
    openAIApiKey: OPENAI_API_KEY,
    modelName: LLM_MODEL,
    temperature: 0.1,
    timeout: TIMEOUTS.LLM_REQUEST_TIMEOUT_MS,
    maxRetries: TIMEOUTS.RETRY_ATTEMPTS,
  });

  try {
    // Attach tools using different methods depending on API version
    // @ts-ignore - Handle API differences in different versions
    return model.bind({
      tools: tools,
    });
  } catch (error) {
    logger.error(
      { error },
      "Error setting up function calling, falling back to basic model"
    );
    return model;
  }
}

/**
 * Create a standard prompt template with system message and messages history
 */
export function createChatPrompt(systemMessage = SYSTEM_MESSAGES.DEFAULT) {
  return ChatPromptTemplate.fromMessages([
    ["system", systemMessage],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
  ]);
}

/**
 * Create a RAG-optimized prompt template
 */
export function createRagPrompt() {
  return ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_MESSAGES.RAG],
    ["placeholder", "{chat_history}"],
    ["system", "Context information:\n{context}"],
    ["human", "{input}"],
  ]);
}

/**
 * Format chat history for insertion into prompts
 * With robust error handling for potentially malformed messages
 */
export function formatChatHistory(messages: BaseMessage[]): string {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "";
  }

  try {
    return messages
      .map((message) => {
        try {
          let role = "unknown";
          let content = "";

          // Safely access the message type
          if (message) {
            if (typeof message._getType === "function") {
              role = message._getType();
            } else {
              // Use any available property
              const msg: any = message;
              role =
                msg.type ||
                (typeof msg._getType === "string" ? msg._getType : "unknown");
            }

            // Safely access content
            content = message.content ? message.content.toString() : "";
          }

          return `${
            role === "human" ? "Human" : role === "ai" ? "Assistant" : "System"
          }: ${content}`;
        } catch (err) {
          logger.warn("Error formatting individual message", {
            error: err,
            message: message,
          });

          return ""; // Skip problematic messages
        }
      })
      .filter((msg) => msg !== "") // Remove empty messages
      .join("\n\n");
  } catch (error) {
    logger.error({ error }, "Error formatting chat history");
    return "Previous conversation history unavailable.";
  }
}
