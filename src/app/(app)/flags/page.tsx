import { flagsModule } from "@/modules/flags/module";
import { requirePermission } from "@/platform/auth/session";
import { ModulePlaceholder } from "@/platform/ui/module-placeholder";

export const dynamic = "force-dynamic";

export default async function FlagsPage(): Promise<React.ReactElement> {
  const actor = await requirePermission("flags.read");
  return <ModulePlaceholder module={flagsModule} role={actor.role} />;
}
