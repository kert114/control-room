import type { ModuleDefinition } from "@/platform/module/contract";

export const refundsModule: ModuleDefinition = {
  id: "refunds",
  title: "Refunds",
  summary: "Review refund requests and decide them under the four-eyes rule.",
  route: "/refunds",
  readPermission: "refunds.read",
  writePermissions: ["refunds.request", "refunds.approve", "refunds.escalate"],
  steps: ["Find refund", "Review request", "Decide"],
  status: "live",
  owner: "Payment operations",
};
