import type { Permission } from "@/platform/authz/policy";

/**
 * Contract every internal tool implements. Adding a new tool means adding a
 * folder under src/modules and registering its definition — no shared file
 * needs to change beyond the registry entry.
 */
export interface ModuleDefinition {
  id: string;
  title: string;
  summary: string;
  route: string;
  readPermission: Permission;
  writePermissions: readonly Permission[];
  /** The three user-facing steps of the tool, per the design contract. */
  steps: readonly [string, string, string];
  status: "live" | "placeholder";
  owner: string;
}

export interface ModuleMetric {
  label: string;
  value: string;
  hint?: string;
}
