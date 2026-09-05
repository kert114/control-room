import { z } from "zod";

import type { FlagEnvironment } from "@/modules/flags/rules";

export const NOTICE_CODES = [
  "request_created",
  "kill_requested",
  "flag_updated",
  "flag_killed",
  "request_applied",
  "request_rejected",
  "request_cancelled",
] as const;
export type NoticeCode = (typeof NOTICE_CODES)[number];

export const SORT_KEYS = ["key", "environment", "rollout", "owner"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

const searchParamsSchema = z.object({
  q: z.string().trim().max(80).optional(),
  env: z.enum(["development", "staging", "production"]).optional(),
  owner: z.string().trim().max(80).optional(),
  sort: z.enum(SORT_KEYS).default("key"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  flag: z.string().uuid().optional(),
  request: z.string().uuid().optional(),
  action: z.enum(["kill"]).optional(),
  notice: z.enum(NOTICE_CODES).optional(),
  ref: z.string().regex(/^CR-\d{1,8}$/).optional(),
});

export interface FlagsQuery {
  q?: string;
  env?: FlagEnvironment;
  owner?: string;
  sort: SortKey;
  dir: "asc" | "desc";
  flag?: string;
  request?: string;
  action?: "kill";
  notice?: NoticeCode;
  ref?: string;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Parses URL state; unknown or malformed values fall back to defaults. */
export function parseFlagsQuery(raw: RawSearchParams): FlagsQuery {
  const single: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    single[key] = Array.isArray(value) ? value[0] : value;
  }
  for (const key of Object.keys(single)) {
    if (single[key] === "") {
      delete single[key];
    }
  }
  const parsed = searchParamsSchema.safeParse(single);
  if (parsed.success) {
    return parsed.data;
  }
  // Drop only the invalid keys so a bad selection never wipes the filters.
  const invalid = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
  const cleaned = Object.fromEntries(
    Object.entries(single).filter(([key]) => !invalid.has(key)),
  );
  return searchParamsSchema.parse(cleaned);
}

export function buildFlagsHref(
  query: FlagsQuery,
  overrides: Partial<Record<keyof FlagsQuery, string | number | undefined>> = {},
): string {
  // Notices describe one completed action; they are dropped from every derived link.
  const { notice: _notice, ref: _ref, ...persistent } = query;
  void _notice;
  void _ref;
  const merged: Record<string, string | number | undefined> = {
    ...persistent,
    ...overrides,
  };
  const params = new URLSearchParams();
  for (const key of ["q", "env", "owner", "sort", "dir", "flag", "request", "action", "notice", "ref"]) {
    const value = merged[key];
    if (value === undefined || value === "") {
      continue;
    }
    if (key === "sort" && value === "key") {
      continue;
    }
    if (key === "dir" && value === "asc") {
      continue;
    }
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `/flags?${search}` : "/flags";
}
