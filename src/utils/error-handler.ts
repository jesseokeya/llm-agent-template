import { NextFunction } from "express";
import { createLogger } from "./logger";

const logger = createLogger("error-handler");

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error factory for creating common error types
 */
export const ErrorFactory = {
  badRequest: (message = "Bad request") => new AppError(message, 400),
  unauthorized: (message = "Unauthorized") => new AppError(message, 401),
  forbidden: (message = "Forbidden") => new AppError(message, 403),
  notFound: (message = "Not found") => new AppError(message, 404),
  conflict: (message = "Conflict") => new AppError(message, 409),
  serverError: (message = "Internal server error") =>
    new AppError(message, 500, true),
  serviceUnavailable: (message = "Service unavailable") =>
    new AppError(message, 503),
};

/**
 * Structured error handling when dealing with async/await
 * This lets us avoid try/catch blocks everywhere
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Async function wrapper for non-Express functions
 */
export async function handleAsync<T>(
  promise: Promise<T>,
  errorMessage = "Operation failed"
): Promise<[T | null, Error | null]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    logger.error({ error }, errorMessage);
    return [null, error as Error];
  }
}

/**
 * Handle errors from external services
 */
export function handleServiceError(error: any, service: string): AppError {
  logger.error({ error, service }, `Error in ${service} service`);

  // Handle specific service errors
  if (service === "dynamodb") {
    if (error.name === "ResourceNotFoundException") {
      return ErrorFactory.notFound(
        `Resource not found in DynamoDB: ${error.message}`
      );
    }
    if (error.name === "ProvisionedThroughputExceededException") {
      return ErrorFactory.serviceUnavailable("DynamoDB throughput exceeded");
    }
  }

  if (service === "pinecone") {
    if (error.name === "TimeoutError") {
      return ErrorFactory.serviceUnavailable("Pinecone service timeout");
    }
  }

  if (service === "openai") {
    if (error.name === "RateLimitError") {
      return ErrorFactory.serviceUnavailable("OpenAI rate limit exceeded");
    }
    if (error.name === "OpenAIError" && error.status === 401) {
      return ErrorFactory.unauthorized("Invalid OpenAI API key");
    }
  }

  // Generic service error
  return new AppError(
    `${service} service error: ${error.message || "Unknown error"}`,
    500,
    true
  );
}

/**
 * Process error and determine if it's operational
 */
export function processError(error: any): AppError {
  // Already an AppError, just return it
  if (error instanceof AppError) {
    return error;
  }

  // Convert specific known errors
  if (error.name === "ValidationError") {
    return ErrorFactory.badRequest(error.message);
  }

  if (error.name === "JsonWebTokenError") {
    return ErrorFactory.unauthorized("Invalid token");
  }

  if (error.name === "TokenExpiredError") {
    return ErrorFactory.unauthorized("Token expired");
  }

  // Generic error
  return new AppError(error.message || "An unknown error occurred", 500, false);
}
