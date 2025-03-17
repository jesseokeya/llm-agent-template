import { BaseMessage } from "@langchain/core/messages";
import { ActionStatus } from "../config/constants";

/**
 * Represents an action extracted from user input
 */
export interface Action {
  id: string;
  type: string;
  data: Record<string, any>;
  status: ActionStatus;
  createdAt: string;
  updatedAt: string;
  result?: Record<string, any> | null;
  error?: string | null;
}

/**
 * Represents a pending action in the conversation state
 */
export interface PendingAction {
  id: string;
  type: string;
  data: Record<string, any>;
  status: ActionStatus;
}

/**
 * Represents the conversation state that will be managed by LangGraph
 */
export interface ConversationState {
  conversationId: string;
  messages: BaseMessage[];
  context: string[];
  pending_actions: PendingAction[];
}

/**
 * Represents the stored conversation state in DynamoDB
 */
export interface StoredConversationState {
  id: string;
  state: string; // JSON stringified ConversationState
  lastUpdated: string; // ISO timestamp
  ttl?: number; // TTL for DynamoDB
  userId?: string; // Optional user ID for multi-tenant systems
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Chat request from the client
 */
export interface ChatRequest {
  message: string;
  conversationId?: string;
  metadata?: Record<string, any>;
}

/**
 * Chat response to the client
 */
export interface ChatResponse {
  message: string;
  conversationId: string;
  actions: PendingAction[];
  metadata?: Record<string, any>;
}

/**
 * Function calling result structure
 */
export interface FunctionCall {
  name: string;
  arguments: string; // JSON string of arguments
}

/**
 * Context chunk from vector store
 */
export interface ContextChunk {
  content: string;
  metadata: Record<string, any>;
  score?: number;
}
