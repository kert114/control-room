import { flagsModule } from "@/modules/flags/module";
import { kycModule } from "@/modules/kyc/module";
import { refundsModule } from "@/modules/refunds/module";
import type { ModuleDefinition } from "@/platform/module/contract";

export const MODULES: readonly ModuleDefinition[] = [
  kycModule,
  refundsModule,
  flagsModule,
];

export function moduleById(id: string): ModuleDefinition | undefined {
  return MODULES.find((module) => module.id === id);
}
