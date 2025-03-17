import { ActionType } from "../config/constants";

/**
 * Function definitions for OpenAI function calling
 * These define the schema for action extraction
 */
export const functionDefinitions = [
  {
    name: ActionType.BOOK_APPOINTMENT,
    description: "Book an appointment or meeting with someone",
    parameters: {
      type: "object",
      properties: {
        person: {
          type: "string",
          description: "The person to meet with",
        },
        date: {
          type: "string",
          description: "The date of the appointment (YYYY-MM-DD format)",
        },
        time: {
          type: "string",
          description: "The time of the appointment (HH:MM format)",
        },
        duration: {
          type: "integer",
          description: "The duration of the meeting in minutes",
          default: 30,
        },
        purpose: {
          type: "string",
          description: "The purpose or topic of the meeting",
        },
        location: {
          type: "string",
          description:
            "The location of the meeting (physical location or virtual)",
          default: "Virtual",
        },
      },
      required: ["person", "date", "time"],
    },
  },
  {
    name: ActionType.TAKE_NOTE,
    description: "Create a note or save information",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title for the note",
        },
        content: {
          type: "string",
          description: "Content of the note",
        },
        category: {
          type: "string",
          description: "Category for organizing the note",
          enum: ["personal", "work", "ideas", "tasks", "other"],
          default: "other",
        },
        tags: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Tags for the note",
        },
      },
      required: ["content"],
    },
  },
  {
    name: ActionType.SET_REMINDER,
    description: "Set a reminder for a future time",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title for the reminder",
        },
        date: {
          type: "string",
          description: "The date for the reminder (YYYY-MM-DD format)",
        },
        time: {
          type: "string",
          description: "The time for the reminder (HH:MM format)",
        },
        description: {
          type: "string",
          description: "Additional details for the reminder",
        },
        priority: {
          type: "string",
          description: "Priority level of the reminder",
          enum: ["low", "medium", "high"],
          default: "medium",
        },
        recurrence: {
          type: "string",
          description: "How often the reminder should repeat",
          enum: ["none", "daily", "weekly", "monthly"],
          default: "none",
        },
      },
      required: ["title", "date", "time"],
    },
  },
  {
    name: ActionType.SEARCH_KNOWLEDGE,
    description: "Search for specific information in the knowledge base",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        filters: {
          type: "object",
          description: "Additional filters for the search",
          properties: {
            category: {
              type: "string",
              description: "Category to search within",
            },
            dateRange: {
              type: "object",
              properties: {
                from: {
                  type: "string",
                  description: "Start date (YYYY-MM-DD)",
                },
                to: {
                  type: "string",
                  description: "End date (YYYY-MM-DD)",
                },
              },
            },
            author: {
              type: "string",
              description: "Author of the content",
            },
          },
        },
        maxResults: {
          type: "integer",
          description: "Maximum number of results to return",
          default: 5,
        },
      },
      required: ["query"],
    },
  },
];

/**
 * Get a function definition by type
 */
export function getFunctionDefinition(type: string) {
  return functionDefinitions.find((def) => def.name === type);
}

/**
 * Validate action data against function definition schema
 */
export function validateActionData(
  type: string,
  data: Record<string, any>
): { valid: boolean; errors?: string[] } {
  const definition = getFunctionDefinition(type);

  if (!definition) {
    return { valid: false, errors: [`Unknown action type: ${type}`] };
  }

  const schema = definition.parameters;
  const errors: string[] = [];

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ""
      ) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Validate data types
  for (const [field, value] of Object.entries(data)) {
    if (value === undefined) continue;

    const fieldSchema = schema.properties[field as keyof typeof schema.properties];
    if (!fieldSchema) {
      errors.push(`Unknown field: ${field}`);
      continue;
    }

    // Type validation
    if (fieldSchema.type === "string" && typeof value !== "string") {
      errors.push(`Field ${field} must be a string`);
    } else if (fieldSchema.type === "integer" && !Number.isInteger(value)) {
      errors.push(`Field ${field} must be an integer`);
    } else if (fieldSchema.type === "array" && !Array.isArray(value)) {
      errors.push(`Field ${field} must be an array`);
    } else if (
      fieldSchema.type === "object" &&
      (typeof value !== "object" || value === null || Array.isArray(value))
    ) {
      errors.push(`Field ${field} must be an object`);
    }
    // Enum validation
    if ('enum' in fieldSchema && !fieldSchema.enum.includes(value)) {
      errors.push(
        `Field ${field} must be one of: ${fieldSchema.enum.join(", ")}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
