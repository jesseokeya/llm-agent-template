import { ActionStatus, ActionType } from "../config/constants";

/**
 * Base action interface with common properties
 */
export interface BaseAction {
  id: string;
  conversationId: string;
  type: string;
  status: ActionStatus;
  createdAt: string;
  updatedAt: string;
  data: Record<string, any>;
  result?: Record<string, any> | null;
  error?: string | null;
}

/**
 * Booking action data structure
 */
export interface BookingActionData {
  person: string;
  date: string;
  time: string;
  duration?: number;
  purpose?: string;
  location?: string;
}

/**
 * Note action data structure
 */
export interface NoteActionData {
  title?: string;
  content: string;
  category?: string;
  tags?: string[];
}

/**
 * Reminder action data structure
 */
export interface ReminderActionData {
  title: string;
  date: string;
  time: string;
  description?: string;
  priority?: "low" | "medium" | "high";
}

/**
 * Type guards for different action types
 */
export function isBookingAction(
  action: BaseAction
): action is BaseAction & { data: BookingActionData } {
  return action.type === ActionType.BOOK_APPOINTMENT;
}

export function isNoteAction(
  action: BaseAction
): action is BaseAction & { data: NoteActionData } {
  return action.type === ActionType.TAKE_NOTE;
}

export function isReminderAction(
  action: BaseAction
): action is BaseAction & { data: ReminderActionData } {
  return action.type === ActionType.SET_REMINDER;
}

/**
 * Action result interfaces
 */
export interface BookingActionResult {
  appointmentId: string;
  confirmed: boolean;
  details?: {
    person: string;
    date: string;
    time: string;
    location?: string;
  };
}

export interface NoteActionResult {
  noteId: string;
  saved: boolean;
  url?: string;
}

export interface ReminderActionResult {
  reminderId: string;
  scheduled: boolean;
  notificationMethod?: "email" | "push" | "sms";
}

/**
 * Create action input (without ID and timestamps)
 */
export type CreateActionInput = Omit<
  BaseAction,
  "id" | "createdAt" | "updatedAt" | "status" | "result" | "error"
>;

/**
 * Update action status input
 */
export interface UpdateActionStatusInput {
  status: ActionStatus;
  result?: Record<string, any> | null;
  error?: string | null;
}

/**
 * Action handler function signature
 */
export type ActionHandler = (action: BaseAction) => Promise<{
  success: boolean;
  result?: Record<string, any>;
  error?: string;
}>;
