import { ConversationState, PendingAction } from "../../types/conversation";
import { createFunctionCallingModel } from "../../models/llm";
import {
  functionDefinitions,
  validateActionData,
} from "../../tools/function-definitions";
import { getLastHumanMessage } from "../state";
import { createAction } from "../../storage/action-store";
import { ActionStatus } from "../../config/constants";
import { createLogger } from "../../utils/logger";
import { v4 as uuidv4 } from "uuid";

const logger = createLogger("extract-actions");

// Initialize function calling model
const functionCallingModel = createFunctionCallingModel(functionDefinitions);

/**
 * Action extraction node for LangGraph
 *
 * This node extracts actions from the user's message using function calling.
 */
export async function extractActionsNode(
  state: ConversationState
): Promise<ConversationState> {
  // Get the last human message
  const lastMessage = getLastHumanMessage(state);

  if (!lastMessage || !lastMessage.content) {
    logger.debug(
      { conversationId: state.conversationId },
      "No human message found, skipping action extraction"
    );
    return state;
  }

  try {
    logger.debug(
      { conversationId: state.conversationId },
      "Extracting actions from message"
    );

    // Call the model with function calling enabled
    const response = await functionCallingModel.invoke(
      lastMessage.content.toString()
    );

    // Check if a function was called
    const functionCall = response.additional_kwargs.function_call;

    if (!functionCall) {
      logger.debug(
        { conversationId: state.conversationId },
        "No action detected"
      );
      return state;
    }

    try {
      // Parse the function arguments
      const actionName = functionCall.name;
      const actionArgs = JSON.parse(functionCall.arguments);

      logger.info(
        { conversationId: state.conversationId, actionType: actionName },
        "Action extracted from message"
      );

      // Validate the action data
      const validation = validateActionData(actionName, actionArgs);

      if (!validation.valid) {
        logger.warn(
          { conversationId: state.conversationId, errors: validation.errors },
          "Invalid action data"
        );

        // Return current state if validation fails
        return state;
      }

      // Generate a local action ID
      const actionId = `pending_${uuidv4()}`;

      // Create pending action for state
      const pendingAction: PendingAction = {
        id: actionId,
        type: actionName,
        data: actionArgs,
        status: ActionStatus.PENDING,
      };

      // Persist the action to DynamoDB
      await createAction({
        conversationId: state.conversationId,
        type: actionName,
        data: actionArgs,
      });

      // Add to state
      return {
        ...state,
        pending_actions: [...state.pending_actions, pendingAction],
      };
    } catch (parseError) {
      logger.error(
        { error: parseError, conversationId: state.conversationId },
        "Error parsing function call"
      );
      return state;
    }
  } catch (error) {
    logger.error(
      { error, conversationId: state.conversationId },
      "Error extracting actions"
    );
    return state;
  }
}

/**
 * Create a specialized action extraction node that only extracts specific action types
 */
export function createSpecificActionExtractor(actionTypes: string[]) {
  // Filter function definitions to only include specified types
  const filteredDefinitions = functionDefinitions.filter((def) =>
    actionTypes.includes(def.name)
  );

  // Create specialized model
  const specializedModel = createFunctionCallingModel(filteredDefinitions);

  return async (state: ConversationState): Promise<ConversationState> => {
    const lastMessage = getLastHumanMessage(state);

    if (!lastMessage || !lastMessage.content) {
      return state;
    }

    try {
      // Call the specialized model
      const response = await specializedModel.invoke(
        lastMessage.content.toString()
      );

      const functionCall = response.additional_kwargs.function_call;

      if (!functionCall) {
        return state;
      }

      // Process extracted action
      const actionName = functionCall.name;
      const actionArgs = JSON.parse(functionCall.arguments);

      // Validation and storage logic same as above
      const validation = validateActionData(actionName, actionArgs);

      if (!validation.valid) {
        return state;
      }

      const actionId = `pending_${uuidv4()}`;

      const pendingAction: PendingAction = {
        id: actionId,
        type: actionName,
        data: actionArgs,
        status: ActionStatus.PENDING,
      };

      await createAction({
        conversationId: state.conversationId,
        type: actionName,
        data: actionArgs,
      });

      return {
        ...state,
        pending_actions: [...state.pending_actions, pendingAction],
      };
    } catch (error) {
      logger.error({ error }, "Error in specialized action extractor");
      return state;
    }
  };
}
