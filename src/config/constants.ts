/**
 * Application constants
 */

// Database table names
export const DB_TABLES = {
  CONVERSATION_STATES: "conversation-states",
  ACTION_QUEUE: "action-queue",
};

// Action status types
export enum ActionStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

// Action types
export enum ActionType {
  BOOK_APPOINTMENT = "book_appointment",
  TAKE_NOTE = "take_note",
  SET_REMINDER = "set_reminder",
  SEARCH_KNOWLEDGE = "search_knowledge",
}

// Conversation constants
export const CONVERSATION = {
  MAX_HISTORY_LENGTH: 10,
  MAX_CONTEXT_CHUNKS: 5,
  DEFAULT_RETRIEVAL_LIMIT: 3,
};

// Rate limiting
export const RATE_LIMITS = {
  MAX_REQUESTS_PER_MINUTE: 60,
  MAX_TOKENS_PER_MINUTE: 10000,
};

// System message for LLM
export const SYSTEM_MESSAGES = {
  DEFAULT: `You are a helpful assistant that can understand context and help users with their questions. 
  You can also perform actions like booking appointments, taking notes, and setting reminders.
  Always provide clear, concise, and accurate responses.`,

  RAG: `You are a helpful assistant with access to a knowledge base.
  When responding to questions, use only the provided context and do not hallucinate information.
  If you don't know the answer based on the provided context, say so.`,
};

// Timeouts and retry configurations
export const TIMEOUTS = {
  LLM_REQUEST_TIMEOUT_MS: 60000, // 60 seconds
  VECTOR_SEARCH_TIMEOUT_MS: 10000, // 10 seconds
  ACTION_EXECUTION_TIMEOUT_MS: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: 1000, // 1 second base for exponential backoff
};

// Cache TTLs
export const CACHE_TTL = {
  VECTOR_SEARCH_TTL_MS: 5 * 60 * 1000, // 5 minutes
  CONVERSATION_STATE_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
};

// API endpoints
export const API_ENDPOINTS = {
  CONVERSATION: "/api/conversation",
  ACTIONS: "/api/actions",
  HEALTH: "/api/health",
};
