import {
  getPendingActions,
  markActionInProgress,
  markActionCompleted,
  markActionFailed,
} from "../storage/action-store";
import { ActionType, TIMEOUTS } from "../config/constants";
import { BaseAction } from "../types/actions";
import { createLogger } from "../utils/logger";

const logger = createLogger("action-processor");

// Mock action handlers
// In a real application, these would connect to actual services

/**
 * Booking handler
 */
async function handleBookingAction(action: BaseAction) {
  logger.info(
    { actionId: action.id, data: action.data },
    "Processing booking action"
  );

  try {
    const { person, date, time, duration = 30, purpose } = action.data;

    // Validate required fields
    if (!person || !date || !time) {
      throw new Error("Missing required fields for booking");
    }

    // Simulate API call to booking service
    await new Promise((resolve) => setTimeout(resolve, 500));

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
          purpose: purpose || "Not specified",
        },
      },
    };
  } catch (error) {
    logger.error({ error, actionId: action.id }, "Booking action failed");
    return {
      success: false,
      error: (error as Error).message || "Booking action failed",
    };
  }
}

/**
 * Note-taking handler
 */
async function handleNoteAction(action: BaseAction) {
  logger.info(
    { actionId: action.id, data: action.data },
    "Processing note action"
  );

  try {
    const {
      title = "Untitled Note",
      content,
      category = "other",
    } = action.data;

    // Validate required fields
    if (!content) {
      throw new Error("Missing required content for note");
    }

    // Simulate API call to note service
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Mock successful note creation
    return {
      success: true,
      result: {
        noteId: `note_${Date.now()}`,
        saved: true,
        title,
        category,
        snippet: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error({ error, actionId: action.id }, "Note action failed");
    return {
      success: false,
      error: (error as Error).message || "Note action failed",
    };
  }
}

/**
 * Reminder handler
 */
async function handleReminderAction(action: BaseAction) {
  logger.info(
    { actionId: action.id, data: action.data },
    "Processing reminder action"
  );

  try {
    const { title, date, time, description, priority = "medium" } = action.data;

    // Validate required fields
    if (!title || !date || !time) {
      throw new Error("Missing required fields for reminder");
    }

    // Simulate API call to reminder service
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Mock successful reminder creation
    return {
      success: true,
      result: {
        reminderId: `reminder_${Date.now()}`,
        scheduled: true,
        notificationTime: `${date} ${time}`,
        priority,
        description: description || "No description provided",
      },
    };
  } catch (error) {
    logger.error({ error, actionId: action.id }, "Reminder action failed");
    return {
      success: false,
      error: (error as Error).message || "Reminder action failed",
    };
  }
}

/**
 * Knowledge search handler
 */
async function handleSearchKnowledgeAction(action: BaseAction) {
  logger.info(
    { actionId: action.id, data: action.data },
    "Processing knowledge search action"
  );

  try {
    const { query, filters, maxResults = 5 } = action.data;
    logger.info({ query, filters, maxResults }, "Knowledge search action data");

    // Validate required fields
    if (!query) {
      throw new Error("Missing required query for knowledge search");
    }

    // Simulate API call to knowledge base
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Mock search results
    const mockResults = [
      {
        id: "doc-1",
        title: "Sample Document 1",
        snippet: "This is a sample document that matches the query...",
        score: 0.92,
      },
      {
        id: "doc-2",
        title: "Sample Document 2",
        snippet: "Another document that contains relevant information...",
        score: 0.87,
      },
    ];

    return {
      success: true,
      result: {
        query,
        resultsCount: mockResults.length,
        results: mockResults,
        filters: filters || {},
      },
    };
  } catch (error) {
    logger.error(
      { error, actionId: action.id },
      "Knowledge search action failed"
    );
    return {
      success: false,
      error: (error as Error).message || "Knowledge search action failed",
    };
  }
}

// Map action types to their handlers
const actionHandlers: Record<string, (action: BaseAction) => Promise<any>> = {
  [ActionType.BOOK_APPOINTMENT]: handleBookingAction,
  [ActionType.TAKE_NOTE]: handleNoteAction,
  [ActionType.SET_REMINDER]: handleReminderAction,
  [ActionType.SEARCH_KNOWLEDGE]: handleSearchKnowledgeAction,
};

/**
 * Process a batch of pending actions
 */
export async function processActions(batchSize = 10) {
  logger.info({ batchSize }, "Starting action processing batch");

  try {
    // Get pending actions
    const pendingActions = await getPendingActions(batchSize);

    if (pendingActions.length === 0) {
      logger.debug("No pending actions to process");
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    logger.info({ count: pendingActions.length }, "Processing pending actions");

    let succeeded = 0;
    let failed = 0;

    // Process each action
    await Promise.all(
      pendingActions.map(async (action) => {
        try {
          // Get handler for this action type
          const handler = actionHandlers[action.type];

          if (!handler) {
            logger.warn(
              { actionId: action.id, type: action.type },
              "No handler for action type"
            );
            await markActionFailed(
              action.id,
              `No handler for action type: ${action.type}`
            );
            failed++;
            return;
          }

          // Mark as in progress
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
            // Mark as completed
            await markActionCompleted(action.id, result.result);
            succeeded++;

            logger.info(
              { actionId: action.id, type: action.type },
              "Action completed successfully"
            );
          } else {
            // Mark as failed
            await markActionFailed(action.id, result.error || "Unknown error");
            failed++;

            logger.warn(
              { actionId: action.id, type: action.type, error: result.error },
              "Action failed"
            );
          }
        } catch (error) {
          // Handle execution errors
          logger.error(
            { error, actionId: action.id, type: action.type },
            "Error executing action"
          );

          await markActionFailed(
            action.id,
            (error as Error).message || "Unknown error"
          );
          failed++;
        }
      })
    );

    logger.info(
      { processed: pendingActions.length, succeeded, failed },
      "Action processing batch completed"
    );

    return {
      processed: pendingActions.length,
      succeeded,
      failed,
    };
  } catch (error) {
    logger.error({ error }, "Error processing actions batch");
    throw error;
  }
}

/**
 * Main worker function that runs continuously
 */
export async function startActionProcessor(
  batchSize = 10,
  intervalMs = 5000,
  shouldContinue = true
) {
  logger.info({ batchSize, intervalMs }, "Starting action processor worker");

  while (shouldContinue) {
    try {
      await processActions(batchSize);
    } catch (error) {
      logger.error({ error }, "Error in action processor loop");
    }

    // Wait for next processing cycle
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  logger.info("Action processor worker stopped");
}

// For direct execution (e.g., via node src/workers/action-processor.ts)
if (require.main === module) {
  startActionProcessor().catch((error) => {
    logger.fatal({ error }, "Fatal error in action processor");
    process.exit(1);
  });
}
