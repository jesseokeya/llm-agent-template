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
    // Cache settings for improved performance
    cache: true,
    maxConcurrency: 5,
  });
}

/**
 * Create a function-calling enabled model with the provided functions
 */
export function createFunctionCallingModel(functions: any[]) {
  logger.debug(
    `Creating function calling model with ${functions.length} functions`
  );

  const model = new ChatOpenAI({
    openAIApiKey: OPENAI_API_KEY,
    modelName: LLM_MODEL,
    temperature: 0.1, // Lower temperature for more deterministic function calls
    timeout: TIMEOUTS.LLM_REQUEST_TIMEOUT_MS,
    maxRetries: TIMEOUTS.RETRY_ATTEMPTS,
  });

  // Format tools for the OpenAI API
  const tools = functions.map((func) => ({
    type: "function" as const,
    function: func,
  }));

  // Bind the tools to the model
  return model.bind({ tools });
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
 */
export function formatChatHistory(messages: BaseMessage[]): string {
  return messages
    .map((message) => {
      const role = message._getType();
      const content = message.content.toString();
      return `${role === "human" ? "Human" : "Assistant"}: ${content}`;
    })
    .join("\n\n");
}
