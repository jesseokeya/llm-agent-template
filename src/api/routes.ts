import express from "express";
import conversationRoutes from "./conversation";
import actionRoutes from "./actions";
import { API_ENDPOINTS } from "../config/constants";
import { createLogger } from "../utils/logger";

const logger = createLogger("routes");
const router: express.Router = express.Router();

// Root endpoint
router.get("/", (req, res) => {
  logger.info({ path: req.path }, "Root endpoint");

  res.json({
    message: "LLM Agent API",
    status: "online",
    version: "1.0.0",
  });
});

// Apply route handlers
router.use(API_ENDPOINTS.CONVERSATION, conversationRoutes);
router.use(API_ENDPOINTS.ACTIONS, actionRoutes);

export default router;
