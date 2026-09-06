import type { ModuleDefinition } from "@/platform/module/contract";

export const kycModule: ModuleDefinition = {
  id: "kyc",
  title: "KYC reviews",
  summary: "Review onboarding cases and record an approve, escalate, or reject decision.",
  route: "/kyc",
  readPermission: "kyc.read",
  writePermissions: [
    "kyc.claim",
    "kyc.assign",
    "kyc.request_info",
    "kyc.decide",
    "kyc.unmask",
  ],
  steps: ["Open queue", "Review case", "Choose decision"],
  status: "live",
  owner: "Financial crime operations",
};
