import { StateGraph } from "@langchain/langgraph";
// import { RunnableSequence } from "@langchain/core/runnables";
import { ConversationState } from "../types/conversation";
import { initialState } from "./state";
import { retrievalNode } from "./nodes/retrieval";
import { extractActionsNode } from "./nodes/extract-actions";
import { executeActionsNode } from "./nodes/execute-actions";
import {
  generateResponseNode,
  generateResponseWithActionSummaryNode,
} from "./nodes/generate";
import { createLogger } from "../utils/logger";

const logger = createLogger("conversation-graph");

/**
 * Create the main conversation graph
 *
 * This graph implements the following flow:
 * 1. Retrieve relevant context
 * 2. Extract potential actions
 * 3. Execute actions if present
 * 4. Generate response based on context and action results
 */
export function createConversationGraph() {
  logger.debug("Creating conversation graph");

  // Create a new graph with the initial state
  const builder = new StateGraph<ConversationState>({
    channels: {
      messages: { value: initialState.messages } as any,
      context: { value: initialState.context } as any,
      pending_actions: { value: initialState.pending_actions } as any,
      conversationId: { value: initialState.conversationId } as any,
    },
  });

  // Add nodes to the graph
  builder.addNode("retrieval", retrievalNode as any);
  builder.addNode("extract_actions", extractActionsNode as any);
  builder.addNode("execute_actions", executeActionsNode as any);
  builder.addNode(
    "generate_response",
    generateResponseWithActionSummaryNode as any
  );

  // Define the edge connections (workflow)
  (builder as any).addEdge("retrieval", "extract_actions");
  (builder as any).addEdge("extract_actions", "execute_actions");
  (builder as any).addEdge("execute_actions", "generate_response");

  // Set the entry point
  (builder as any).setEntryPoint("retrieval");

  // Compile the graph
  const graph = builder.compile();

  logger.info("Conversation graph created successfully");

  return graph;
}

/**
 * Create a simpler RAG-only conversation graph
 *
 * This graph only retrieves context and generates a response,
 * without action extraction or execution.
 */
export function createRagOnlyGraph() {
  logger.debug("Creating RAG-only conversation graph");

  // Create a new graph with the initial state
  const builder = new StateGraph<ConversationState>({
    channels: {
      messages: { value: initialState.messages } as any,
      context: { value: initialState.context } as any,
      pending_actions: { value: initialState.pending_actions } as any,
      conversationId: { value: initialState.conversationId } as any,
    },
  });

  // Add nodes to the graph
  builder.addNode("retrieval", retrievalNode as any);
  builder.addNode("generate_response", generateResponseNode as any);

  // Define the edge connections
  (builder as any).addEdge("retrieval", "generate_response");

  // Set the entry point
  (builder as any).setEntryPoint("retrieval");

  // Compile the graph
  const graph = builder.compile();

  logger.info("RAG-only conversation graph created successfully");

  return graph;
}

/**
 * Create a custom graph with conditional branching based on action presence
 */
export function createAdvancedConversationGraph() {
  logger.debug("Creating advanced conversation graph with conditionals");

  // Create a new graph with the initial state
  const builder = new StateGraph<ConversationState>({
    channels: {
      messages: { value: initialState.messages } as any,
      context: { value: initialState.context } as any,
      pending_actions: { value: initialState.pending_actions } as any,
      conversationId: { value: initialState.conversationId } as any,
    },
  });

  // Add nodes to the graph
  builder.addNode("retrieval", retrievalNode as any);
  builder.addNode("extract_actions", extractActionsNode as any);
  builder.addNode("execute_actions", executeActionsNode as any);
  builder.addNode("generate_response", generateResponseNode as any);
  builder.addNode(
    "generate_with_actions",
    generateResponseWithActionSummaryNode as any
  );

  // Define conditional routing - check if actions were extracted
  (builder as any).addConditionalEdges(
    "extract_actions",
    (state: any) => {
      // Route based on whether actions were extracted
      return state.pending_actions.length > 0 ? "has_actions" : "no_actions";
    },
    {
      has_actions: "execute_actions",
      no_actions: "generate_response",
    }
  );

  // Connect execute_actions to generation with action summary
  (builder as any).addEdge("execute_actions", "generate_with_actions");

  // Connect retrieval to extract_actions
  (builder as any).addEdge("retrieval", "extract_actions");

  // Set the entry point
  (builder as any).setEntryPoint("retrieval");

  // Compile the graph
  const graph = builder.compile();

  logger.info("Advanced conversation graph created successfully");

  return graph;
}

/**
 * Create a custom graph with specific action type handling
 */
export function createCustomActionGraph(actionTypes: string[]) {
  logger.debug({ actionTypes }, "Creating custom action graph");

  // Create a new graph with the initial state
  const builder = new StateGraph<ConversationState>({
    channels: {
      messages: { value: initialState.messages } as any,
      context: { value: initialState.context } as any,
      pending_actions: { value: initialState.pending_actions } as any,
      conversationId: { value: initialState.conversationId } as any,
    },
  });

  // Add specialized nodes that only handle specific action types
  builder.addNode("retrieval", retrievalNode as any);
  builder.addNode("extract_actions", extractActionsNode as any);
  builder.addNode("execute_actions", executeActionsNode as any);
  builder.addNode(
    "generate_response",
    generateResponseWithActionSummaryNode as any
  );

  // Connect the nodes
  (builder as any).addEdge("retrieval", "extract_actions");
  (builder as any).addEdge("extract_actions", "execute_actions");
  (builder as any).addEdge("execute_actions", "generate_response");

  // Set the entry point
  (builder as any).setEntryPoint("retrieval");

  // Compile the graph
  const graph = builder.compile();

  logger.info("Custom action graph created successfully");

  return graph;
}
