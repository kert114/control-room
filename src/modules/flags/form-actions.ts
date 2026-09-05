"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { requirePermission, type Actor } from "@/platform/auth/session";
import { AuthorizationError } from "@/platform/authz/errors";
import type { Permission } from "@/platform/authz/policy";

import {
  applyDirectChange,
  approveChangeRequest,
  cancelChangeRequest,
  createChangeRequest,
  rejectChangeRequest,
  requestKillSwitch,
  type ActionOutcome,
  type FlagsActionResult,
} from "@/modules/flags/actions";
import type { FormState } from "@/modules/flags/form-state";
import {
  cancelSchema,
  decisionSchema,
  fieldErrors,
  killSwitchSchema,
  rolloutChangeSchema,
} from "@/modules/flags/schemas";
import { buildFlagsHref, parseFlagsQuery } from "@/modules/flags/url-state";

/** Where to land after a successful mutation, with the outcome notice in the URL. */
function successHref(formData: FormData, outcome: ActionOutcome): string {
  const returnTo = formData.get("returnTo");
  const url = new URL(typeof returnTo === "string" ? returnTo : "/flags", "http://flags.local");
  if (url.pathname !== "/flags") {
    url.pathname = "/flags";
    url.search = "";
  }
  const query = parseFlagsQuery(Object.fromEntries(url.searchParams.entries()));
  const selected =
    outcome.entityType === "change_request"
      ? { request: outcome.entityId, action: undefined }
      : { action: undefined };
  return buildFlagsHref(query, { ...selected, notice: outcome.notice, ref: outcome.reference });
}

async function run<TSchema extends z.ZodTypeAny>(
  permission: Permission,
  schema: TSchema,
  formData: FormData,
  handler: (actor: Actor, input: z.infer<TSchema>) => Promise<FlagsActionResult>,
): Promise<FormState> {
  let actor: Actor;
  try {
    actor = await requirePermission(permission);
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return { status: "forbidden", message: error.message };
    }
    throw error;
  }
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "invalid", fieldErrors: fieldErrors(parsed.error) };
  }
  const result = await handler(actor, parsed.data);
  if (!result.ok) {
    return { status: result.code, message: result.message };
  }
  revalidatePath("/flags");
  redirect(successHref(formData, result.data));
}

export async function submitChangeRequest(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return run("flags.request_change", rolloutChangeSchema, formData, createChangeRequest);
}

export async function submitDirectChange(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return run("flags.edit_nonproduction", rolloutChangeSchema, formData, applyDirectChange);
}

export async function submitKillSwitch(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return run("flags.kill", killSwitchSchema, formData, requestKillSwitch);
}

export async function submitDecision(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const decision = formData.get("decision");
  if (decision !== "approve" && decision !== "reject") {
    return { status: "invalid", fieldErrors: { decision: "Choose approve or reject." } };
  }
  return run(
    "flags.approve_change",
    decisionSchema,
    formData,
    decision === "approve" ? approveChangeRequest : rejectChangeRequest,
  );
}

export async function submitCancellation(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return run("flags.request_change", cancelSchema, formData, cancelChangeRequest);
}
