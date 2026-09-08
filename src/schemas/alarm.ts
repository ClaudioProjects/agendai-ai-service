import { z } from "zod";

export const eventTypes = [
  "DEFAULT",
  "HEALTH",
  "DENTIST",
  "WORK",
  "STUDY",
  "EXERCISE",
  "FINANCE",
  "FOOD",
  "SHOPPING",
  "SOCIAL",
  "MEDICATION",
  "OTHER",
] as const;
export const recurrenceTypes = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;

export const alarmDraftSchema = z
  .object({
    id: z.string().nullable(),
    eventType: z.enum(eventTypes).nullable(),
    date: z.string().date().nullable(),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    recurrence: z
      .object({
        type: z.enum(recurrenceTypes).nullable(),
        endDate: z.string().date().nullable(),
        daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable(),
      })
      .nullable(),
    notifications: z.array(z.number().int().nonnegative()).nullable(),
    status: z.enum(["pending", "completed"]).nullable(),
    createdAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime().nullable(),
    exceptions: z
      .record(z.string(), z.enum(["completed", "cancelled"]))
      .nullable(),
    title: z.string().nullable(),
    description: z.string().nullable(),
    eventColor: z.string().nullable(),
  })
  .strict();

export const alarmDraftArraySchema = z.array(alarmDraftSchema);
export const alarmDraftResponseSchema = z
  .object({ drafts: alarmDraftArraySchema })
  .strict();
export type AlarmDraft = z.infer<typeof alarmDraftSchema>;
