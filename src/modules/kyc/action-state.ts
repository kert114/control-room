export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string; caseId: string; version: number }
  | { status: "invalid"; message: string; fieldErrors: Record<string, string> }
  | {
      status: "forbidden" | "version_conflict" | "business_rule";
      message: string;
    };

export type UnmaskState =
  | { status: "idle" }
  | { status: "revealed"; field: string; value: string; caseId: string }
  | {
      status: "invalid" | "forbidden" | "version_conflict" | "business_rule";
      message: string;
    };

export const idleState: ActionState = { status: "idle" };
export const idleUnmaskState: UnmaskState = { status: "idle" };
