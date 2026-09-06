import type { ModuleDefinition } from "@/platform/module/contract";

export const flagsModule: ModuleDefinition = {
  id: "flags",
  title: "Feature flags",
  summary: "Change rollout targeting; production changes need a second approver.",
  route: "/flags",
  readPermission: "flags.read",
  writePermissions: [
    "flags.request_change",
    "flags.approve_change",
    "flags.edit_nonproduction",
    "flags.kill",
  ],
  steps: ["Browse flags", "Set rollout", "Approve production"],
  status: "live",
  owner: "Platform engineering",
};
