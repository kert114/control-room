"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/platform/auth/session";
import { AuthorizationError } from "@/platform/authz/errors";

import {
  approveRefund,
  escalateRefund,
  rejectRefund,
  type RefundActionResult,
} from "@/modules/refunds/service";

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function decideRefundAction(
  _previous: RefundActionResult | null,
  formData: FormData,
): Promise<RefundActionResult> {
  const decision = formValue(formData, "decision");
  const input = {
    id: formValue(formData, "id"),
    version: formValue(formData, "version"),
    decisionNote: formValue(formData, "decisionNote"),
  };

  try {
    let result: RefundActionResult;
    if (decision === "approve") {
      const actor = await requirePermission("refunds.approve");
      result = await approveRefund(actor, input);
    } else if (decision === "reject") {
      const actor = await requirePermission("refunds.approve");
      result = await rejectRefund(actor, input);
    } else if (decision === "escalate") {
      const actor = await requirePermission("refunds.escalate");
      result = await escalateRefund(actor, input);
    } else {
      return {
        ok: false,
        code: "validation",
        fieldErrors: { decision: "Choose a decision before continuing." },
        message: "Choose a decision before continuing.",
      };
    }
    if (result.ok) revalidatePath("/refunds");
    return result;
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return {
        ok: false,
        code: "forbidden",
        message: error.message,
      };
    }
    throw error;
  }
}
