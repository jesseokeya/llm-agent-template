import { z } from "zod";
import { ActionStatus, ActionType } from "../config/constants";

/**
 * Common validation schemas used throughout the application
 */

/**
 * Basic ID format validation
 */
export const idSchema = z.string().min(3).max(100);

/**
 * Conversation ID validation
 */
export const conversationIdSchema = z.string().regex(/^conv_[a-zA-Z0-9-_]+$/);

/**
 * Action ID validation
 */
export const actionIdSchema = z.string().regex(/^act_[a-zA-Z0-9-_]+$/);

/**
 * Chat message validation
 */
export const chatMessageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  conversationId: conversationIdSchema.optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Action status validation
 */
export const actionStatusSchema = z.enum([
  ActionStatus.PENDING,
  ActionStatus.IN_PROGRESS,
  ActionStatus.COMPLETED,
  ActionStatus.FAILED,
  ActionStatus.CANCELLED,
]);

/**
 * Action type validation
 */
export const actionTypeSchema = z.enum([
  ActionType.BOOK_APPOINTMENT,
  ActionType.TAKE_NOTE,
  ActionType.SET_REMINDER,
  ActionType.SEARCH_KNOWLEDGE,
]);

/**
 * Booking action data validation
 */
export const bookingActionSchema = z.object({
  person: z.string().min(1, "Person is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  duration: z.number().int().positive().optional(),
  purpose: z.string().optional(),
  location: z.string().optional(),
});

/**
 * Note action data validation
 */
export const noteActionSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  category: z.enum(["personal", "work", "ideas", "tasks", "other"]).optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Reminder action data validation
 */
export const reminderActionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
});

/**
 * Search knowledge action data validation
 */
export const searchKnowledgeActionSchema = z.object({
  query: z.string().min(1, "Query is required"),
  filters: z
    .object({
      category: z.string().optional(),
      dateRange: z
        .object({
          from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
            .optional(),
          to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
            .optional(),
        })
        .optional(),
      author: z.string().optional(),
    })
    .optional(),
  maxResults: z.number().int().positive().optional(),
});

/**
 * Validate action data based on action type
 */
export function validateActionData(
  type: string,
  data: any
): z.SafeParseReturnType<any, any> {
  switch (type) {
    case ActionType.BOOK_APPOINTMENT:
      return bookingActionSchema.safeParse(data);
    case ActionType.TAKE_NOTE:
      return noteActionSchema.safeParse(data);
    case ActionType.SET_REMINDER:
      return reminderActionSchema.safeParse(data);
    case ActionType.SEARCH_KNOWLEDGE:
      return searchKnowledgeActionSchema.safeParse(data);
    default:
      return {
        success: false,
        error: new z.ZodError([
          {
            code: "invalid_enum_value",
            path: ["type"],
            message: `Invalid action type: ${type}. Expected one of: ${Object.values(
              ActionType
            ).join(", ")}`,
            received: type,
            options: Object.values(ActionType),
          },
        ]),
      };
  }
}

/**
 * Chat pagination parameters validation
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

/**
 * Date range validation
 */
export const dateRangeSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

/**
 * Email validation
 */
export const emailSchema = z.string().email("Invalid email address");

/**
 * ISO date validation
 */
export const isoDateSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
    "Date must be in ISO format"
  );
