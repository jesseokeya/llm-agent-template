import { ConversationState } from "../../types/conversation";
import { querySimilarDocuments } from "../../vectorstore/vector-store";
import { getLastHumanMessage } from "../state";
import { createLogger } from "../../utils/logger";
import { CONVERSATION } from "../../config/constants";

const logger = createLogger("retrieval-node");

/**
 * Retrieval node for LangGraph
 *
 * This node retrieves relevant context from the vector store based on the user's query.
 */
export async function retrievalNode(
  state: ConversationState
): Promise<ConversationState> {
  // Get the last human message to use as query
  const lastMessage = getLastHumanMessage(state);

  if (!lastMessage || !lastMessage.content) {
    logger.debug(
      { conversationId: state.conversationId },
      "No human message found, skipping retrieval"
    );

    return state;
  }

  const query = lastMessage.content.toString();

  try {
    logger.debug(
      { conversationId: state.conversationId, query },
      "Retrieving context"
    );

    // Get relevant documents
    const contextChunks = await querySimilarDocuments(
      query,
      CONVERSATION.DEFAULT_RETRIEVAL_LIMIT
    );

    if (contextChunks.length === 0) {
      logger.debug(
        { conversationId: state.conversationId },
        "No relevant context found"
      );
      return {
        ...state,
        context: [],
      };
    }

    // Format retrieved context
    const formattedContext = contextChunks.map((chunk, i) => {
      return `[${i + 1}] ${chunk.content}`;
    });

    logger.debug(
      {
        conversationId: state.conversationId,
        contextCount: contextChunks.length,
      },
      "Retrieved context successfully"
    );

    // Return updated state with context
    return {
      ...state,
      context: formattedContext,
    };
  } catch (error) {
    logger.error(
      { error, conversationId: state.conversationId },
      "Error retrieving context"
    );

    // Return state without context in case of error
    return {
      ...state,
      context: [],
    };
  }
}

/**
 * Alternative retrieval node with metadata filtering
 */
export function createFilteredRetrievalNode(
  metadataFilter?: Record<string, any>
) {
  return async (state: ConversationState): Promise<ConversationState> => {
    // Get the last human message to use as query
    const lastMessage = getLastHumanMessage(state);

    if (!lastMessage || !lastMessage.content) {
      return state;
    }

    const query = lastMessage.content.toString();

    try {
      // Get relevant documents with filter
      const contextChunks = await querySimilarDocuments(
        query,
        CONVERSATION.DEFAULT_RETRIEVAL_LIMIT,
        undefined,
        metadataFilter
      );

      // Format and return the context
      const formattedContext = contextChunks.map((chunk, i) => {
        return `[${i + 1}] ${chunk.content}`;
      });

      return {
        ...state,
        context: formattedContext,
      };
    } catch (error) {
      logger.error({ error }, "Error in filtered retrieval");
      return {
        ...state,
        context: [],
      };
    }
  };
}
