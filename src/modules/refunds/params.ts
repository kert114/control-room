import { z } from "zod";

const REFUND_STATUSES = [
  "draft",
  "pending_approval",
  "escalated",
  "approved",
  "rejected",
  "settled",
] as const;

const STATUS_VALUES = ["all", "open", ...REFUND_STATUSES] as const;
const SORT_VALUES = ["createdAt", "amount", "reference", "status"] as const;
const DIR_VALUES = ["asc", "desc"] as const;
const DECISION_VALUES = ["approve", "reject", "escalate"] as const;

export type Decision = (typeof DECISION_VALUES)[number];
export type ListStatus = (typeof STATUS_VALUES)[number];
export type ListSort = (typeof SORT_VALUES)[number];
export type ListDirection = (typeof DIR_VALUES)[number];

export interface ListParams {
  q: string;
  status: ListStatus;
  min?: number;
  max?: number;
  sort: ListSort;
  dir: ListDirection;
  refund?: string;
  step: 1 | 2 | 3;
  decision?: Decision;
}

const rawValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

function parseMinor(value: string | undefined): number | undefined {
  if (!value?.trim() || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) {
    return undefined;
  }
  const [whole, fraction = ""] = value.trim().split(".");
  const minor = Number(`${whole}${fraction.padEnd(2, "0")}`);
  return Number.isSafeInteger(minor) ? minor : undefined;
}

const uuidSchema = z.string().uuid();

export const approveInputSchema = z.object({
  id: uuidSchema,
  version: z.coerce.number().int().min(1),
});

export const escalateInputSchema = approveInputSchema;

export const rejectInputSchema = approveInputSchema.extend({
  decisionNote: z
    .string()
    .trim()
    .min(5, "Enter a rejection reason of at least 5 characters.")
    .max(500, "Keep the rejection reason under 500 characters."),
});

export const listParamsSchema = z.object({
  q: z.string().trim().max(80).default(""),
  status: z.enum(STATUS_VALUES).default("open"),
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().nonnegative().optional(),
  sort: z.enum(SORT_VALUES).default("createdAt"),
  dir: z.enum(DIR_VALUES).default("desc"),
  refund: uuidSchema.optional(),
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  decision: z.enum(DECISION_VALUES).optional(),
});

export function parseListParams(
  raw: Record<string, string | string[] | undefined>,
): ListParams {
  const status = rawValue(raw.status);
  const sort = rawValue(raw.sort);
  const dir = rawValue(raw.dir);
  const decision = rawValue(raw.decision);
  const parsed = listParamsSchema.safeParse({
    q: rawValue(raw.q) ?? "",
    status: STATUS_VALUES.includes(status as ListStatus) ? status : "open",
    min: parseMinor(rawValue(raw.min)),
    max: parseMinor(rawValue(raw.max)),
    sort: SORT_VALUES.includes(sort as ListSort) ? sort : "createdAt",
    dir: DIR_VALUES.includes(dir as ListDirection) ? dir : "desc",
    refund: uuidSchema.safeParse(rawValue(raw.refund)).success
      ? rawValue(raw.refund)
      : undefined,
    step: [1, 2, 3].includes(Number(rawValue(raw.step)))
      ? Number(rawValue(raw.step))
      : 1,
    decision: DECISION_VALUES.includes(decision as Decision)
      ? decision
      : undefined,
  });

  if (!parsed.success) {
    return {
      q: "",
      status: "open",
      sort: "createdAt",
      dir: "desc",
      step: 1,
    };
  }
  return parsed.data;
}

export const REFUNDS_PATH = "/refunds";

export function buildRefundsHref(
  params: Partial<ListParams>,
  basePath: string = REFUNDS_PATH,
): string {
  const query = new URLSearchParams();
  const q = params.q?.trim();
  if (q) query.set("q", q);
  if (params.status && params.status !== "open") query.set("status", params.status);
  if (params.min !== undefined) query.set("min", (params.min / 100).toFixed(2));
  if (params.max !== undefined) query.set("max", (params.max / 100).toFixed(2));
  if (params.sort && params.sort !== "createdAt") query.set("sort", params.sort);
  if (params.dir && params.dir !== "desc") query.set("dir", params.dir);
  if (params.refund) query.set("refund", params.refund);
  if (params.step && params.step !== 1) query.set("step", String(params.step));
  if (params.decision) query.set("decision", params.decision);
  const serialized = query.toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
}

export type RefundStatus = (typeof REFUND_STATUSES)[number];
