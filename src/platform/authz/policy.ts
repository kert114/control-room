export const ROLES = [
  "operator",
  "approver",
  "administrator",
  "auditor",
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "overview.read",
  "audit.read",
  "kyc.read",
  "kyc.decide",
  "kyc.claim",
  "kyc.assign",
  "kyc.request_info",
  "kyc.unmask",
  "refunds.read",
  "refunds.request",
  "refunds.approve",
  "refunds.escalate",
  "flags.read",
  "flags.request_change",
  "flags.approve_change",
  "flags.edit_nonproduction",
  "flags.kill",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const READ_ONLY: readonly Permission[] = [
  "overview.read",
  "audit.read",
  "kyc.read",
  "refunds.read",
  "flags.read",
];

export const PERMISSION_MATRIX: Record<Role, readonly Permission[]> = {
  operator: [
    ...READ_ONLY,
    "kyc.decide",
    "kyc.claim",
    "kyc.request_info",
    "kyc.unmask",
    "refunds.request",
    "refunds.escalate",
    "flags.request_change",
  ],
  approver: [
    ...READ_ONLY,
    "kyc.decide",
    "kyc.claim",
    "kyc.assign",
    "kyc.request_info",
    "kyc.unmask",
    "refunds.approve",
    "flags.approve_change",
  ],
  administrator: [
    ...READ_ONLY,
    "kyc.decide",
    "kyc.claim",
    "kyc.assign",
    "kyc.request_info",
    "kyc.unmask",
    "refunds.request",
    "refunds.approve",
    "refunds.escalate",
    "flags.request_change",
    "flags.approve_change",
    "flags.edit_nonproduction",
    "flags.kill",
  ],
  auditor: READ_ONLY,
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSION_MATRIX[role].includes(permission);
}

/**
 * Separation of duties: the actor who created a record can never approve it,
 * regardless of role.
 */
export function canApproveOwnRecord(
  actorId: string,
  createdById: string,
): boolean {
  return actorId !== createdById;
}

export function isReadOnly(role: Role): boolean {
  return role === "auditor";
}
