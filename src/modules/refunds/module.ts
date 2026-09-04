import type { ModuleDefinition } from "@/platform/module/contract";

export const refundsModule: ModuleDefinition = {
  id: "refunds",
  title: "Refunds",
  summary: "Raise refunds against settled payments and approve them under the four-eyes rule.",
  route: "/refunds",
  readPermission: "refunds.read",
  writePermissions: ["refunds.request", "refunds.approve"],
  steps: ["Find payment", "Enter refund", "Approve"],
  status: "placeholder",
  owner: "Payment operations",
};
