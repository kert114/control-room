import { refundsModule } from "@/modules/refunds/module";
import { requirePermission } from "@/platform/auth/session";
import { ModulePlaceholder } from "@/platform/ui/module-placeholder";

export const dynamic = "force-dynamic";

export default async function RefundsPage(): Promise<React.ReactElement> {
  const actor = await requirePermission("refunds.read");
  return <ModulePlaceholder module={refundsModule} role={actor.role} />;
}
