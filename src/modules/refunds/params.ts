import { z } from "zod";

const REFUND_STATUSES = [
  "draft",
  "pending_approval",
  "escalated",
  "approved",
  "rejected",
  "settled",
] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

/** Statuses an approver can still act on; everything else is closed. */
export const OPEN_STATUSES: readonly RefundStatus[] = ["pending_approval", "escalated"];
export const CLOSED_STATUSES: readonly RefundStatus[] = ["approved", "rejected", "settled"];

export function isOpenStatus(status: RefundStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

const SORT_VALUES = ["createdAt", "amount", "reference", "status"] as const;
const DIR_VALUES = ["asc", "desc"] as const;
const DECISION_VALUES = ["approve", "reject", "escalate"] as const;
const RANGE_VALUES = ["week", "month", "year", "all"] as const;

export type Decision = (typeof DECISION_VALUES)[number];
export type ListSort = (typeof SORT_VALUES)[number];
export type ListDirection = (typeof DIR_VALUES)[number];
export type VolumeRange = (typeof RANGE_VALUES)[number];

export interface ListParams {
  q: string;
  /** Selected statuses; empty means the default open queue. */
  status: RefundStatus[];
  min?: number;
  max?: number;
  sort: ListSort;
  dir: ListDirection;
  range: VolumeRange;
  refund?: string;
  step: 1 | 2 | 3;
  decision?: Decision;
}

const DEFAULTS: ListParams = {
  q: "",
  status: [],
  sort: "createdAt",
  dir: "asc",
  range: "month",
  step: 1,
};

export function effectiveStatuses(status: RefundStatus[]): readonly RefundStatus[] {
  return status.length === 0 ? OPEN_STATUSES : status;
}

const rawValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

function rawStatuses(value: string | string[] | undefined): RefundStatus[] {
  const values = (Array.isArray(value) ? value : value === undefined ? [] : [value])
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim());
  if (values.includes("all")) return [...OPEN_STATUSES, ...CLOSED_STATUSES];
  return REFUND_STATUSES.filter(
    (status) => status !== "draft" && values.includes(status),
  );
}

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
  status: z.array(z.enum(REFUND_STATUSES)).default([]),
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().nonnegative().optional(),
  sort: z.enum(SORT_VALUES).default(DEFAULTS.sort),
  dir: z.enum(DIR_VALUES).default(DEFAULTS.dir),
  range: z.enum(RANGE_VALUES).default(DEFAULTS.range),
  refund: uuidSchema.optional(),
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  decision: z.enum(DECISION_VALUES).optional(),
});

export function parseListParams(
  raw: Record<string, string | string[] | undefined>,
): ListParams {
  const sort = rawValue(raw.sort);
  const dir = rawValue(raw.dir);
  const range = rawValue(raw.range);
  const decision = rawValue(raw.decision);
  const parsed = listParamsSchema.safeParse({
    q: rawValue(raw.q) ?? "",
    status: rawStatuses(raw.status),
    min: parseMinor(rawValue(raw.min)),
    max: parseMinor(rawValue(raw.max)),
    sort: SORT_VALUES.includes(sort as ListSort) ? sort : DEFAULTS.sort,
    dir: DIR_VALUES.includes(dir as ListDirection) ? dir : DEFAULTS.dir,
    range: RANGE_VALUES.includes(range as VolumeRange) ? range : DEFAULTS.range,
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

  if (!parsed.success) return { ...DEFAULTS, status: [] };
  return parsed.data;
}

export const REFUNDS_PATH = "/refunds";

export function buildRefundsHref(params: Partial<ListParams>): string {
  const query = new URLSearchParams();
  const q = params.q?.trim();
  if (q) query.set("q", q);
  if (params.status && params.status.length > 0) {
    query.set("status", params.status.join(","));
  }
  if (params.min !== undefined) query.set("min", (params.min / 100).toFixed(2));
  if (params.max !== undefined) query.set("max", (params.max / 100).toFixed(2));
  if (params.sort && params.sort !== DEFAULTS.sort) query.set("sort", params.sort);
  if (params.dir && params.dir !== DEFAULTS.dir) query.set("dir", params.dir);
  if (params.range && params.range !== DEFAULTS.range) query.set("range", params.range);
  if (params.refund) query.set("refund", params.refund);
  if (params.step && params.step !== 1) query.set("step", String(params.step));
  if (params.decision) query.set("decision", params.decision);
  const serialized = query.toString();
  return serialized ? `${REFUNDS_PATH}?${serialized}` : REFUNDS_PATH;
}

/** Filters that narrow the queue (the selected record, sort, and chart range do not). */
export function hasQueueFilters(params: ListParams): boolean {
  return (
    params.q !== "" ||
    params.status.length > 0 ||
    params.min !== undefined ||
    params.max !== undefined
  );
}
