// Import the StateGraph for version checking
import { StateGraph } from "@langchain/langgraph";
import { createLogger } from "./utils/logger";

// Create logger for server diagnostics
const logger = createLogger("server");

// Check LangGraph version
try {
  logger.info(
    {
      stateGraphType: typeof StateGraph,
      hasCompileMethod: typeof StateGraph.prototype?.compile === "function",
      stateGraphProperties: Object.getOwnPropertyNames(StateGraph.prototype),
    },
    "LangGraph StateGraph information"
  );
} catch (error) {
  logger.error({ error }, "Error checking StateGraph");
}
