import { ConversationState, PendingAction } from "../../types/conversation";
import { createFunctionCallingModel } from "../../models/llm";
import {
  functionDefinitions,
  validateActionData,
} from "../../tools/function-definitions";
import { getLastHumanMessage } from "../state";
import { HumanMessage } from "@langchain/core/messages";
import { createAction } from "../../storage/action-store";
import { ActionStatus } from "../../config/constants";
import { createLogger } from "../../utils/logger";
import { v4 as uuidv4 } from "uuid";

const logger = createLogger("extract-actions");

// Initialize function calling model with updated function definitions
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
    const response = await functionCallingModel.invoke([
      new HumanMessage(lastMessage.content.toString()),
    ]);

    // Check if a function was called - handle different API versions
    const toolCalls = response.additional_kwargs?.tool_calls;
    const functionCall = response.additional_kwargs?.function_call;

    let extractedAction = null;

    // Handle newer OpenAI API which uses tool_calls
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      logger.debug({ toolCalls }, "Found tool calls in response");

      const firstTool = toolCalls[0];
      if (firstTool.type === "function" && firstTool.function) {
        extractedAction = {
          name: firstTool.function.name,
          arguments: firstTool.function.arguments,
        };
      }
    }
    // Handle older API which uses function_call
    else if (functionCall) {
      logger.debug({ functionCall }, "Found function call in response");
      extractedAction = {
        name: functionCall.name,
        arguments: functionCall.arguments,
      };
    }

    // If no action was detected, return current state
    if (!extractedAction) {
      logger.debug(
        { conversationId: state.conversationId },
        "No action detected"
      );
      return state;
    }

    try {
      // Parse the function arguments
      const actionName = extractedAction.name;
      const actionArgs = JSON.parse(extractedAction.arguments);

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
      {
        error,
        message: (error as Error).message,
        conversationId: state.conversationId,
      },
      "Error extracting actions"
    );
    return state;
  }
}
