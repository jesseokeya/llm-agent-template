import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
dotenv.config();

// Define environment variable schema for validation
const envSchema = z.object({
  // Server configuration
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().transform(Number).default("3000"),

  // API Keys
  OPENAI_API_KEY: z.string({
    required_error: "OPENAI_API_KEY is required in the environment variables",
  }),

  // Vector DB - Pinecone
  PINECONE_API_KEY: z.string({
    required_error: "PINECONE_API_KEY is required in the environment variables",
  }),
  PINECONE_INDEX: z.string({
    required_error: "PINECONE_INDEX is required in the environment variables",
  }),
  PINECONE_ENVIRONMENT: z.string().optional(),

  // AWS Configuration (for DynamoDB)
  AWS_REGION: z.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // LLM Configuration
  LLM_MODEL: z.string().default("gpt-4o"),
  LLM_TEMPERATURE: z.string().transform(Number).default("0.2"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-large"),

  // Application configuration
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  CONVERSATION_TTL_DAYS: z.string().transform(Number).default("30"),
});

// Parse and validate environment variables
const envResult = envSchema.safeParse(process.env);

// Handle validation errors
if (!envResult.success) {
  console.error("❌ Invalid environment variables:");
  const errors = envResult.error.format();

  // Log each error for each environment variable
  Object.entries(errors)
    .filter(([key]) => key !== "_errors")
    .forEach(([key, value]) => {
      console.error(`${key}: ${(value as any)._errors.join(", ")}`);
    });

  process.exit(1);
}

// Export the validated environment variables
export const env = envResult.data;

// Export individual variables for convenience
export const {
  NODE_ENV,
  PORT,
  OPENAI_API_KEY,
  PINECONE_API_KEY,
  PINECONE_INDEX,
  PINECONE_ENVIRONMENT,
  AWS_REGION,
  LLM_MODEL,
  LLM_TEMPERATURE,
  EMBEDDING_MODEL,
  LOG_LEVEL,
  CONVERSATION_TTL_DAYS,
} = env;

// Utility to check if we're in a production environment
export const isProd = NODE_ENV === "production";
export const isDev = NODE_ENV === "development";
export const isTest = NODE_ENV === "test";
