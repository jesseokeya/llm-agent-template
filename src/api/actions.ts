import express from "express";
import { z } from "zod";
import { ActionStatus } from "../config/constants";
import {
  getConversationActions,
  getAction,
  updateActionStatus,
  markActionFailed,
  markActionCompleted,
} from "../storage/action-store";
import { createLogger } from "../utils/logger";

const logger = createLogger("actions-api");
const router: express.Router = express.Router();

// Validation schemas
const actionIdSchema = z.string().regex(/^act_[a-zA-Z0-9-_]+$/);
const updateActionSchema = z.object({
  status: z.enum([
    ActionStatus.PENDING,
    ActionStatus.IN_PROGRESS,
    ActionStatus.COMPLETED,
    ActionStatus.FAILED,
    ActionStatus.CANCELLED,
  ]),
  result: z.record(z.any()).optional(),
  error: z.string().optional(),
});

/**
 * GET /api/actions/conversation/:conversationId
 * Get all actions for a conversation
 */
router.get(
  "/conversation/:conversationId",
  // @ts-ignore - TODO: fix this
  async (req: express.Request, res: express.Response) => {
    try {
      const { conversationId } = req.params;

      logger.debug({ conversationId }, "Getting actions for conversation");

      const actions = await getConversationActions(conversationId);

      return res.json({
        conversationId,
        actions,
        count: actions.length,
      });
    } catch (error) {
      logger.error(
        { error, conversationId: req.params.conversationId },
        "Error getting conversation actions"
      );

      return res.status(500).json({
        error: "An error occurred retrieving actions",
        message: (error as Error).message,
      });
    }
  }
);

/**
 * GET /api/actions/:actionId
 * Get a specific action
 */
// @ts-ignore - TODO: fix this
router.get("/:actionId", async (req, res) => {
  try {
    const validationResult = actionIdSchema.safeParse(req.params.actionId);

    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid action ID format",
      });
    }

    const actionId = validationResult.data;

    logger.debug({ actionId }, "Getting action");

    const action = await getAction(actionId);

    if (!action) {
      return res.status(404).json({
        error: "Action not found",
      });
    }

    return res.json(action);
  } catch (error) {
    logger.error(
      { error, actionId: req.params.actionId },
      "Error getting action"
    );

    return res.status(500).json({
      error: "An error occurred retrieving the action",
      message: (error as Error).message,
    });
  }
});

/**
 * PUT /api/actions/:actionId
 * Update an action's status
 */
// @ts-ignore - TODO: fix this
router.put("/:actionId", async (req, res) => {
  try {
    const actionIdResult = actionIdSchema.safeParse(req.params.actionId);
    const updateResult = updateActionSchema.safeParse(req.body);

    if (!actionIdResult.success) {
      return res.status(400).json({
        error: "Invalid action ID format",
      });
    }

    if (!updateResult.success) {
      return res.status(400).json({
        error: "Invalid update data",
        details: updateResult.error.errors,
      });
    }

    const actionId = actionIdResult.data;
    const updateData = updateResult.data;

    logger.debug(
      { actionId, status: updateData.status },
      "Updating action status"
    );

    // Check if action exists
    const action = await getAction(actionId);

    if (!action) {
      return res.status(404).json({
        error: "Action not found",
      });
    }

    // Update the action
    await updateActionStatus(actionId, updateData);

    // Get the updated action
    const updatedAction = await getAction(actionId);

    return res.json(updatedAction);
  } catch (error) {
    logger.error(
      { error, actionId: req.params.actionId },
      "Error updating action"
    );

    return res.status(500).json({
      error: "An error occurred updating the action",
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/actions/:actionId/complete
 * Mark an action as completed
 */
// @ts-ignore - TODO: fix this
router.post("/:actionId/complete", async (req, res) => {
  try {
    const actionIdResult = actionIdSchema.safeParse(req.params.actionId);

    if (!actionIdResult.success) {
      return res.status(400).json({
        error: "Invalid action ID format",
      });
    }

    const actionId = actionIdResult.data;
    const result = req.body.result || {};

    logger.debug({ actionId }, "Marking action as completed");

    // Check if action exists
    const action = await getAction(actionId);

    if (!action) {
      return res.status(404).json({
        error: "Action not found",
      });
    }

    // Mark the action as completed
    await markActionCompleted(actionId, result);

    // Get the updated action
    const updatedAction = await getAction(actionId);

    return res.json(updatedAction);
  } catch (error) {
    logger.error(
      { error, actionId: req.params.actionId },
      "Error completing action"
    );

    return res.status(500).json({
      error: "An error occurred completing the action",
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/actions/:actionId/fail
 * Mark an action as failed
 */
// @ts-ignore - TODO: fix this
router.post("/:actionId/fail", async (req, res) => {
  try {
    const actionIdResult = actionIdSchema.safeParse(req.params.actionId);

    if (!actionIdResult.success) {
      return res.status(400).json({
        error: "Invalid action ID format",
      });
    }

    const actionId = actionIdResult.data;
    const error = req.body.error || "Action failed";

    logger.debug({ actionId }, "Marking action as failed");

    // Check if action exists
    const action = await getAction(actionId);

    if (!action) {
      return res.status(404).json({
        error: "Action not found",
      });
    }

    // Mark the action as failed
    await markActionFailed(actionId, error);

    // Get the updated action
    const updatedAction = await getAction(actionId);

    return res.json(updatedAction);
  } catch (error) {
    logger.error(
      { error, actionId: req.params.actionId },
      "Error failing action"
    );

    return res.status(500).json({
      error: "An error occurred marking the action as failed",
      message: (error as Error).message,
    });
  }
});

export default router;
