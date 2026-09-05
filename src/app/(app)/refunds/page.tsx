import { requirePermission } from "@/platform/auth/session";

import { RefundsWorkspace } from "@/app/(app)/refunds/refunds-workspace";
import { getPolicy, getRefundDetail, listRefunds, summarizeRefunds, volumeByStatus } from "@/modules/refunds/queries";
import { parseListParams, type ListParams } from "@/modules/refunds/params";

export const dynamic = "force-dynamic";

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const actor = await requirePermission("refunds.read");
  const raw = await searchParams;
  const parsed = parseListParams(raw);
  const params: ListParams = {
    ...parsed,
    step: !parsed.refund
      ? 1
      : parsed.decision
        ? 3
        : (Math.min(parsed.step, 2) as 1 | 2),
  };
  const [list, summary, volume, detail, policy] = await Promise.all([
    listRefunds(params),
    summarizeRefunds(),
    volumeByStatus(),
    params.refund ? getRefundDetail(params.refund) : Promise.resolve(null),
    getPolicy(),
  ]);

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
    />
  );
}
