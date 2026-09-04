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
  "refunds.read",
  "refunds.request",
  "refunds.approve",
  "flags.read",
  "flags.request_change",
  "flags.approve_change",
  "flags.edit_nonproduction",
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
  operator: [...READ_ONLY, "kyc.decide", "refunds.request", "flags.request_change"],
  approver: [
    ...READ_ONLY,
    "kyc.decide",
    "refunds.approve",
    "flags.approve_change",
  ],
  administrator: [
    ...READ_ONLY,
    "kyc.decide",
    "refunds.request",
    "refunds.approve",
    "flags.request_change",
    "flags.approve_change",
    "flags.edit_nonproduction",
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
