import type { Role } from "@/platform/authz/policy";

/**
 * Synthetic accounts. These exist only to demonstrate the role model and are
 * usable exclusively when DEMO_MODE=true.
 */
export const DEMO_PASSWORD = "control-room-demo";

export interface DemoUser {
  email: string;
  name: string;
  role: Role;
}

export const DEMO_USERS: readonly DemoUser[] = [
  { email: "operator@demo.control-room.test", name: "Ola Operator", role: "operator" },
  { email: "approver@demo.control-room.test", name: "Ada Approver", role: "approver" },
  {
    email: "admin@demo.control-room.test",
    name: "Adem Administrator",
    role: "administrator",
  },
  { email: "auditor@demo.control-room.test", name: "Ava Auditor", role: "auditor" },
];
