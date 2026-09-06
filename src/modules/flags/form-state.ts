import type { FieldErrors } from "@/modules/flags/schemas";

/** Failures only: a successful submission redirects with a URL notice instead. */
export type FormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: FieldErrors }
  | { status: "forbidden" | "business_rule"; message: string }
  | { status: "version_conflict"; message: string };

export const IDLE: FormState = { status: "idle" };
