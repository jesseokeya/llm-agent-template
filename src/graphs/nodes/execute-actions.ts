import { ConversationState } from "../../types/conversation";
import { ActionStatus, ActionType } from "../../config/constants";
import { updateAction } from "../state";
import {
  markActionInProgress,
  markActionCompleted,
  markActionFailed,
} from "../../storage/action-store";
import { createLogger } from "../../utils/logger";
import { TIMEOUTS } from "../../config/constants";

const logger = createLogger("execute-actions");

/**
 * Mock action handlers for demonstration
 * In a real application, these would connect to actual services
 */

// Booking handler
async function handleBookingAction(action: any) {
  logger.info(
    { actionId: action.id, data: action.data },
    "Executing booking action"
  );

  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 500));

  const { person, date, time, duration = 30 } = action.data;

  // Mock successful booking
  return {
    success: true,
    result: {
      appointmentId: `appt_${Date.now()}`,
      confirmed: true,
      details: {
        person,
        date,
        time,
        duration,
      },
    },
  };
}

// Note handler
async function handleNoteAction(action: any) {
  logger.info(
    { actionId: action.id, data: action.data },
    "Executing note action"
  );

  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 300));

  const { title = "Untitled Note", content } = action.data;

  // Mock successful note creation
  return {
    success: true,
    result: {
      noteId: `note_${Date.now()}`,
      saved: true,
      title,
      snippet: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
    },
  };
}

// Reminder handler
async function handleReminderAction(action: any) {
  logger.info(
    { actionId: action.id, data: action.data },
    "Executing reminder action"
  );

  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 400));

  const { title, date, time } = action.data;
  logger.info({ title, date, time }, "Reminder action data");

  // Mock successful reminder creation
  return {
    success: true,
    result: {
      reminderId: `reminder_${Date.now()}`,
      scheduled: true,
      notificationTime: `${date} ${time}`,
    },
  };
}

// Map action types to their handlers
const actionHandlers: Record<string, (action: any) => Promise<any>> = {
  [ActionType.BOOK_APPOINTMENT]: handleBookingAction,
  [ActionType.TAKE_NOTE]: handleNoteAction,
  [ActionType.SET_REMINDER]: handleReminderAction,
};

/**
 * Action execution node for LangGraph
 *
 * This node executes pending actions and updates their status.
 */
export async function executeActionsNode(
  state: ConversationState
): Promise<ConversationState> {
  const { pending_actions } = state;

  // Skip if no pending actions
  if (!pending_actions.length) {
    logger.debug(
      { conversationId: state.conversationId },
      "No pending actions to execute"
    );
    return state;
  }

  logger.info(
    {
      conversationId: state.conversationId,
      actionCount: pending_actions.length,
    },
    "Executing pending actions"
  );

  // Create a copy of state to modify
  let updatedState = { ...state };

  // Process each pending action
  for (const action of pending_actions) {
    // Skip actions that are not pending
    if (action.status !== ActionStatus.PENDING) {
      continue;
    }

    const handler = actionHandlers[action.type];

    if (!handler) {
      logger.warn(
        { conversationId: state.conversationId, actionType: action.type },
        "No handler for action type"
      );

      // Update action status in state
      updatedState = updateAction(updatedState, action.id, {
        status: ActionStatus.FAILED,
      });

      // Update action status in database
      await markActionFailed(
        action.id,
        `No handler for action type: ${action.type}`
      );
      continue;
    }

    try {
      // Mark action as in progress
      updatedState = updateAction(updatedState, action.id, {
        status: ActionStatus.IN_PROGRESS,
      });

      await markActionInProgress(action.id);

      // Execute action with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Action execution timed out")),
          TIMEOUTS.ACTION_EXECUTION_TIMEOUT_MS
        );
      });

      const result = await Promise.race([handler(action), timeoutPromise]);

      if (result.success) {
        // Mark action as completed
        updatedState = updateAction(updatedState, action.id, {
          status: ActionStatus.COMPLETED,
        });

        await markActionCompleted(action.id, result.result);

        logger.info(
          { conversationId: state.conversationId, actionId: action.id },
          "Action completed successfully"
        );
      } else {
        // Mark action as failed
        updatedState = updateAction(updatedState, action.id, {
          status: ActionStatus.FAILED,
        });

        await markActionFailed(action.id, result.error || "Unknown error");

        logger.warn(
          {
            conversationId: state.conversationId,
            actionId: action.id,
            error: result.error,
          },
          "Action failed"
        );
      }
    } catch (error) {
      // Handle execution errors
      logger.error(
        { error, conversationId: state.conversationId, actionId: action.id },
        "Error executing action"
      );

      // Update action status
      updatedState = updateAction(updatedState, action.id, {
        status: ActionStatus.FAILED,
      });

      await markActionFailed(
        action.id,
        (error as Error).message || "Unknown error"
      );
    }
  }

  return updatedState;
}

/**
 * Create a specialized action executor for specific action types
 */
export function createActionExecutor(actionTypes: string[]) {
  return async (state: ConversationState): Promise<ConversationState> => {
    const { pending_actions } = state;

    // Filter actions by type
    const relevantActions = pending_actions.filter(
      (action) =>
        actionTypes.includes(action.type) &&
        action.status === ActionStatus.PENDING
    );

    if (relevantActions.length === 0) {
      return state;
    }

    let updatedState = { ...state };

    // Process each action
    for (const action of relevantActions) {
      const handler = actionHandlers[action.type];

      if (!handler) {
        continue;
      }

      try {
        // Mark action as in progress
        updatedState = updateAction(updatedState, action.id, {
          status: ActionStatus.IN_PROGRESS,
        });

        await markActionInProgress(action.id);

        // Execute action
        const result = await handler(action);

        if (result.success) {
          updatedState = updateAction(updatedState, action.id, {
            status: ActionStatus.COMPLETED,
          });

          await markActionCompleted(action.id, result.result);
        } else {
          updatedState = updateAction(updatedState, action.id, {
            status: ActionStatus.FAILED,
          });

          await markActionFailed(action.id, result.error || "Unknown error");
        }
      } catch (error) {
        updatedState = updateAction(updatedState, action.id, {
          status: ActionStatus.FAILED,
        });

        await markActionFailed(action.id, (error as Error).message);
      }
    }

    return updatedState;
  };
}
