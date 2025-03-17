import pino from "pino";
import { LOG_LEVEL, NODE_ENV } from "../config/env";

// Configure the logger based on environment
const pinoConfig: pino.LoggerOptions = {
  level: LOG_LEVEL,
  // Prettier formatting for development
  ...(NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
  // Production configuration for structured logging
  ...(NODE_ENV === "production" && {
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    redact: ["req.headers.authorization", "*.password", "*.apiKey"],
  }),
};

// Create the logger instance
const logger = pino(pinoConfig);

// Export a function to create child loggers with context
export function createLogger(context: string) {
  return logger.child({ context });
}

export default logger;
