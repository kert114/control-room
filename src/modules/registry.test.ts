import { describe, expect, it } from "vitest";

import { MODULES, moduleById } from "@/modules/registry";
import { PERMISSIONS } from "@/platform/authz/policy";

describe("module registry", () => {
  it("exposes stable routes for every module", () => {
    expect(MODULES.map((definition) => definition.route)).toEqual([
      "/kyc",
      "/refunds",
      "/flags",
    ]);
  });

  it("keeps each workflow at three steps", () => {
    for (const definition of MODULES) {
      expect(definition.steps).toHaveLength(3);
    }
  });

  it("declares only permissions the platform knows", () => {
    for (const definition of MODULES) {
      expect(PERMISSIONS).toContain(definition.readPermission);
      for (const permission of definition.writePermissions) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it("looks a module up by id", () => {
    expect(moduleById("refunds")?.title).toBe("Refunds");
    expect(moduleById("unknown")).toBeUndefined();
  });
});
