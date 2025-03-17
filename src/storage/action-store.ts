import { v4 as uuidv4 } from "uuid";
import {
  BaseAction,
  CreateActionInput,
  UpdateActionStatusInput,
} from "../types/actions";
import { ActionStatus } from "../config/constants";
import { DB_TABLES } from "../config/constants";
import {
  getItem,
  putItem,
  updateItem,
  queryItems,
  scanItems,
} from "./dynamo-client";
import { createLogger } from "../utils/logger";

const logger = createLogger("action-store");
const TABLE_NAME = DB_TABLES.ACTION_QUEUE;

/**
 * Create a new action and store it in DynamoDB
 */
export async function createAction(
  input: CreateActionInput
): Promise<BaseAction> {
  logger.debug(
    { type: input.type, conversationId: input.conversationId },
    "Creating new action"
  );

  try {
    const now = new Date().toISOString();
    const actionId = `act_${uuidv4()}`;

    const action: BaseAction = {
      id: actionId,
      status: ActionStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    await putItem(TABLE_NAME, action);

    logger.debug(
      { actionId, type: action.type },
      "Action created successfully"
    );
    return action;
  } catch (error) {
    logger.error({ error, type: input.type }, "Failed to create action");
    throw new Error(`Failed to create action: ${(error as Error).message}`);
  }
}

/**
 * Get an action by ID
 */
export async function getAction(actionId: string): Promise<BaseAction | null> {
  logger.debug({ actionId }, "Getting action");

  try {
    return await getItem<BaseAction>(TABLE_NAME, { id: actionId });
  } catch (error) {
    logger.error({ error, actionId }, "Failed to get action");
    throw new Error(`Failed to get action: ${(error as Error).message}`);
  }
}

/**
 * Update action status and result/error
 */
export async function updateActionStatus(
  actionId: string,
  input: UpdateActionStatusInput
): Promise<void> {
  logger.debug({ actionId, status: input.status }, "Updating action status");

  try {
    const now = new Date().toISOString();

    await updateItem(
      TABLE_NAME,
      { id: actionId },
      "SET #status = :status, updatedAt = :updatedAt, #result = :result, #error = :error",
      {
        "#status": "status",
        "#result": "result",
        "#error": "error",
      },
      {
        ":status": input.status,
        ":updatedAt": now,
        ":result": input.result || null,
        ":error": input.error || null,
      }
    );

    logger.debug(
      { actionId, status: input.status },
      "Action status updated successfully"
    );
  } catch (error) {
    logger.error({ error, actionId }, "Failed to update action status");
    throw new Error(
      `Failed to update action status: ${(error as Error).message}`
    );
  }
}

/**
 * Get all actions for a conversation
 */
export async function getConversationActions(
  conversationId: string
): Promise<BaseAction[]> {
  logger.debug({ conversationId }, "Getting actions for conversation");

  try {
    // Requires a GSI on conversationId
    const actions = await queryItems<BaseAction>(
      TABLE_NAME,
      "conversationId = :conversationId",
      {},
      { ":conversationId": conversationId },
      "conversationId-index"
    );

    logger.debug(
      { conversationId, count: actions.length },
      "Retrieved conversation actions"
    );
    return actions;
  } catch (error) {
    logger.error(
      { error, conversationId },
      "Failed to get conversation actions"
    );
    throw new Error(
      `Failed to get conversation actions: ${(error as Error).message}`
    );
  }
}

/**
 * Get pending actions for processing
 */
export async function getPendingActions(limit = 50): Promise<BaseAction[]> {
  logger.debug("Getting pending actions");

  try {
    const actions = await scanItems<BaseAction>(
      TABLE_NAME,
      "#status = :status",
      { "#status": "status" },
      { ":status": ActionStatus.PENDING }
    );

    // Limit the number of actions returned
    const limitedActions = actions.slice(0, limit);

    logger.debug({ count: limitedActions.length }, "Retrieved pending actions");
    return limitedActions;
  } catch (error) {
    logger.error({ error }, "Failed to get pending actions");
    throw new Error(
      `Failed to get pending actions: ${(error as Error).message}`
    );
  }
}

/**
 * Mark action as in progress
 */
export async function markActionInProgress(actionId: string): Promise<void> {
  await updateActionStatus(actionId, {
    status: ActionStatus.IN_PROGRESS,
  });
}

/**
 * Mark action as completed with result
 */
export async function markActionCompleted(
  actionId: string,
  result: Record<string, any>
): Promise<void> {
  await updateActionStatus(actionId, {
    status: ActionStatus.COMPLETED,
    result,
  });
}

/**
 * Mark action as failed with error
 */
export async function markActionFailed(
  actionId: string,
  error: string
): Promise<void> {
  await updateActionStatus(actionId, {
    status: ActionStatus.FAILED,
    error,
  });
}
