import { can } from "@/platform/authz/policy";
import { requirePermission } from "@/platform/auth/session";

import { RefundsWorkspace } from "@/app/(app)/refunds/refunds-workspace";
import { permissionForDecision } from "@/modules/refunds/decisions";
import { getPolicy, getRefundDetail, listRefunds, summarizeRefunds, volumeByStatus } from "@/modules/refunds/queries";
import { parseListParams, type ListParams } from "@/modules/refunds/params";
import { availableDecisions } from "@/modules/refunds/transitions";

export const dynamic = "force-dynamic";

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const actor = await requirePermission("refunds.read");
  const raw = await searchParams;
  const parsed = parseListParams(raw);
  const baseParams: ListParams = {
    ...parsed,
    step: !parsed.refund
      ? 1
      : (Math.min(parsed.step, 2) as 1 | 2),
  };
  const [list, summary, volume, detail, policy] = await Promise.all([
    listRefunds(baseParams),
    summarizeRefunds(),
    volumeByStatus(),
    baseParams.refund ? getRefundDetail(baseParams.refund) : Promise.resolve(null),
    getPolicy(),
  ]);
  const allowedDecisions = detail
    ? availableDecisions(detail.status).filter((decision) =>
        can(actor.role, permissionForDecision(decision)),
      )
    : [];
  const decision =
    detail && parsed.decision && allowedDecisions.includes(parsed.decision)
      ? parsed.decision
      : undefined;
  const params: ListParams = {
    ...baseParams,
    step: !parsed.refund ? 1 : decision ? 3 : 2,
    decision,
  };

  return (
    <RefundsWorkspace
      actor={actor}
      params={params}
      list={list}
      summary={summary}
      volume={volume}
      detail={detail}
      policy={policy}
      missing={Boolean(params.refund) && !detail}
      allowedDecisions={allowedDecisions}
    />
  );
}
