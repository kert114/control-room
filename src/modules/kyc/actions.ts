"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import {
  claimCase,
  decideCase,
  reassignCase,
  requestInformation,
  resumeReview,
  unmaskIdentity,
  type CaseOutcome,
} from "@/modules/kyc/mutations";
import {
  CHECKLIST_ITEMS,
  claimInputSchema,
  decideInputSchema,
  reassignInputSchema,
  requestInformationInputSchema,
  resumeInputSchema,
  unmaskInputSchema,
} from "@/modules/kyc/schemas";
import type { ActionState, UnmaskState } from "@/modules/kyc/action-state";
import { STATUS_LABELS } from "@/modules/kyc/transitions";
import { requireActor, type Actor } from "@/platform/auth/session";
import type { MutationResult } from "@/platform/mutations/errors";


function formValues(formData: FormData): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }
  return values;
}

function invalid(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    if (key && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return {
    status: "invalid",
    message: "Fix the highlighted fields and submit again.",
    fieldErrors,
  };
}

function fromOutcome(
  result: MutationResult<CaseOutcome>,
  describe: (outcome: CaseOutcome) => string,
): ActionState {
  if (!result.ok) {
    return { status: result.code, message: result.message };
  }
  revalidatePath("/kyc");
  return {
    status: "success",
    message: describe(result.data),
    caseId: result.data.caseId,
    version: result.data.version,
  };
}

async function runCaseAction<TInput>(
  schema: z.ZodType<TInput, z.ZodTypeDef, unknown>,
  formData: FormData,
  run: (actor: Actor, input: TInput) => Promise<MutationResult<CaseOutcome>>,
  describe: (outcome: CaseOutcome) => string,
): Promise<ActionState> {
  const actor = await requireActor();
  const parsed = schema.safeParse(formValues(formData));
  if (!parsed.success) {
    return invalid(parsed.error);
  }
  return fromOutcome(await run(actor, parsed.data), describe);
}

export async function claimCaseAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runCaseAction(
    claimInputSchema,
    formData,
    claimCase,
    (outcome) => `${outcome.reference} is now in review and assigned to you.`,
  );
}

export async function resumeReviewAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runCaseAction(
    resumeInputSchema,
    formData,
    resumeReview,
    (outcome) => `${outcome.reference} is back in review.`,
  );
}

export async function reassignCaseAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runCaseAction(
    reassignInputSchema,
    formData,
    reassignCase,
    (outcome) => `${outcome.reference} was reassigned.`,
  );
}

export async function requestInformationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runCaseAction(
    requestInformationInputSchema,
    formData,
    requestInformation,
    (outcome) =>
      `${outcome.reference} is paused while information is requested.`,
  );
}

export async function decideCaseAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const checklist = Object.fromEntries(
    CHECKLIST_ITEMS.map(({ key }) => [key, formData.get(key) === "on"]),
  );
  const values = { ...formValues(formData), checklist };
  const actor = await requireActor();
  const parsed = decideInputSchema.safeParse(values);
  if (!parsed.success) {
    return invalid(parsed.error);
  }
  return fromOutcome(
    await decideCase(actor, parsed.data),
    (outcome) =>
      `${outcome.reference} is now ${STATUS_LABELS[outcome.status].toLowerCase()}.`,
  );
}

export async function unmaskIdentityAction(
  _previous: UnmaskState,
  formData: FormData,
): Promise<UnmaskState> {
  const actor = await requireActor();
  const parsed = unmaskInputSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return { status: "invalid", message: "Choose an identity field to reveal." };
  }
  const result = await unmaskIdentity(actor, parsed.data);
  if (!result.ok) {
    return { status: result.code, message: result.message };
  }
  return {
    status: "revealed",
    field: result.data.field,
    value: result.data.value,
    caseId: parsed.data.caseId,
  };
}
