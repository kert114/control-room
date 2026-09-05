import { kycModule } from "@/modules/kyc/module";
import { KycWorkspace } from "@/modules/kyc/ui/workspace";
import { parseQueueParams, type RawSearchParams } from "@/modules/kyc/schemas";
import { requirePermission } from "@/platform/auth/session";

export const dynamic = "force-dynamic";

export default async function KycPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}): Promise<React.ReactElement> {
  const actor = await requirePermission(kycModule.readPermission);
  const params = parseQueueParams(await searchParams);
  return <KycWorkspace actor={actor} params={params} />;
}
