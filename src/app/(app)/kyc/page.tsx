import { kycModule } from "@/modules/kyc/module";
import { requirePermission } from "@/platform/auth/session";
import { ModulePlaceholder } from "@/platform/ui/module-placeholder";

export const dynamic = "force-dynamic";

export default async function KycPage(): Promise<React.ReactElement> {
  const actor = await requirePermission("kyc.read");
  return <ModulePlaceholder module={kycModule} role={actor.role} />;
}
