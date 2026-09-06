import { z } from "zod";

import { regionCodesSchema } from "@/modules/flags/targeting";

const flagRef = {
  flagId: z.string().uuid(),
  flagVersion: z.coerce.number().int().positive(),
};

const requestRef = {
  requestId: z.string().uuid(),
  requestVersion: z.coerce.number().int().positive(),
};

const reason = z
  .string()
  .trim()
  .min(10, "Give a reason of at least 10 characters.")
  .max(500, "Keep the reason under 500 characters.");

const ticket = z
  .string()
  .trim()
  .max(32, "Ticket reference is too long.")
  .regex(/^[A-Z][A-Z0-9]*-\d+$/, "Use the ticket format PROJ-123.")
  .optional()
  .or(z.literal("").transform(() => undefined));

const note = z
  .string()
  .trim()
  .max(500, "Keep the note under 500 characters.")
  .optional()
  .or(z.literal("").transform(() => undefined));

const enabled = z
  .enum(["on", "off"], { message: "Choose whether the flag is on or off." })
  .transform((value) => value === "on");

const rolloutPercentage = z.coerce
  .number({ message: "Enter a rollout percentage." })
  .int("Rollout must be a whole number.")
  .min(0, "Rollout cannot be below 0%.")
  .max(100, "Rollout cannot exceed 100%.");

export const rolloutChangeSchema = z.object({
  ...flagRef,
  enabled,
  rolloutPercentage,
  reason,
  ticket,
});

export type RolloutChangeInput = z.infer<typeof rolloutChangeSchema>;

/** Checkbox groups arrive as a string, a list, or nothing at all. */
const regions = z.preprocess(
  (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]),
  regionCodesSchema,
);

/** Development and staging edits can also restrict the rollout to regions. */
export const directChangeSchema = rolloutChangeSchema.extend({ regions });

export type DirectChangeInput = z.infer<typeof directChangeSchema>;

export const killSwitchSchema = z.object({
  ...flagRef,
  confirmation: z.string().trim().min(1, "Type the flag key to confirm."),
  reason,
});

export type KillSwitchInput = z.infer<typeof killSwitchSchema>;

export const decisionSchema = z.object({
  ...requestRef,
  flagVersion: z.coerce.number().int().positive().optional(),
  note,
});

export type DecisionInput = z.infer<typeof decisionSchema>;

export const cancelSchema = z.object({ ...requestRef });

export type CancelInput = z.infer<typeof cancelSchema>;

export type FieldErrors = Record<string, string>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}
