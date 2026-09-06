import { z } from "zod";

import { KYC_STATUSES } from "@/modules/kyc/transitions";
import {
  kycDecisionEnum,
  kycIdentityFieldEnum,
  kycRiskEnum,
} from "@/platform/db/schema";

export const RISK_LEVELS = kycRiskEnum.enumValues;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const IDENTITY_FIELDS = kycIdentityFieldEnum.enumValues;
export type IdentityField = (typeof IDENTITY_FIELDS)[number];

export const SLA_FILTERS = ["breached", "due_24h", "on_track"] as const;
export type SlaFilter = (typeof SLA_FILTERS)[number];

export const QUEUE_SORT_KEYS = [
  "sla",
  "risk",
  "opened",
  "reference",
  "status",
] as const;
export type QueueSortKey = (typeof QUEUE_SORT_KEYS)[number];

export const STATUS_FILTERS = ["open", ...KYC_STATUSES] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .enum(values)
    .optional()
    .catch(undefined);

/** Repeated query values (`?status=a&status=b`) become a de-duplicated list. */
const enumList = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      const raw = value === undefined ? [] : Array.isArray(value) ? value : [value];
      const allowed = new Set<string>(values);
      return [...new Set(raw.filter((item) => allowed.has(item)))] as T[number][];
    })
    .catch([]);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined))
    .catch(undefined);

/**
 * Queue state lives in the URL. Every value is parsed on the server; unknown
 * or malformed values fall back to the default instead of failing the page.
 */
export const queueParamsSchema = z.object({
  q: optionalText(80),
  risk: enumList(RISK_LEVELS),
  status: enumList(STATUS_FILTERS),
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase())
    .optional()
    .catch(undefined),
  /** `me`, `unassigned`, or a reviewer id. */
  assignee: optionalText(64),
  sla: optionalEnum(SLA_FILTERS),
  sort: z.enum(QUEUE_SORT_KEYS).catch("sla"),
  dir: z.enum(["asc", "desc"]).catch("asc"),
  case: z.string().uuid().optional().catch(undefined),
  step: z.enum(["decide"]).optional().catch(undefined),
});

export type QueueParams = z.infer<typeof queueParamsSchema>;

export type RawSearchParams = Record<string, string | string[] | undefined>;

const LIST_KEYS: ReadonlySet<string> = new Set(["risk", "status"]);

export function parseQueueParams(raw: RawSearchParams): QueueParams {
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Array.isArray(value) && !LIST_KEYS.has(key) ? value[0] : value,
    ]),
  );
  return queueParamsSchema.parse(flat);
}

const versioned = {
  caseId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
};

const requiredText = (label: string, max: number) =>
  z
    .string({ required_error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const claimInputSchema = z.object(versioned);
export type ClaimInput = z.infer<typeof claimInputSchema>;

export const resumeInputSchema = z.object(versioned);
export type ResumeInput = z.infer<typeof resumeInputSchema>;

export const reassignInputSchema = z.object({
  ...versioned,
  assigneeId: z
    .string({ required_error: "Choose a reviewer." })
    .uuid("Choose a reviewer."),
});
export type ReassignInput = z.infer<typeof reassignInputSchema>;

export const requestInformationInputSchema = z.object({
  ...versioned,
  reason: requiredText("A reason", 500),
});
export type RequestInformationInput = z.infer<
  typeof requestInformationInputSchema
>;

export const CHECKLIST_ITEMS = [
  { key: "identityVerified", label: "Identity evidence verified" },
  { key: "sanctionsScreened", label: "Sanctions screening reviewed" },
  { key: "sourceOfFundsReviewed", label: "Source of funds reviewed" },
] as const;

export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]["key"];

export const checklistSchema = z.object({
  identityVerified: z.boolean(),
  sanctionsScreened: z.boolean(),
  sourceOfFundsReviewed: z.boolean(),
});
export type Checklist = z.infer<typeof checklistSchema>;

export const DECISIONS = kycDecisionEnum.enumValues;
export type Decision = (typeof DECISIONS)[number];

export const DECISION_LABELS: Readonly<Record<Decision, string>> = {
  approve: "Approve case",
  escalate: "Submit for escalation",
  reject: "Reject case",
};

export const decideInputSchema = z
  .object({
    ...versioned,
    decision: z.enum(DECISIONS, {
      errorMap: () => ({ message: "Choose approve, escalate, or reject." }),
    }),
    rationale: z
      .string()
      .trim()
      .max(1000, "A rationale must be 1000 characters or fewer.")
      .optional()
      .transform((value) => value ?? ""),
    checklist: checklistSchema,
  })
  .superRefine((input, context) => {
    if (
      input.decision === "approve" &&
      !Object.values(input.checklist).every(Boolean)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checklist"],
        message: "Every checklist item must be complete before approving.",
      });
    }
  });
export type DecideInput = z.infer<typeof decideInputSchema>;

export const unmaskInputSchema = z.object({
  ...versioned,
  field: z.enum(IDENTITY_FIELDS),
});
export type UnmaskInput = z.infer<typeof unmaskInputSchema>;
