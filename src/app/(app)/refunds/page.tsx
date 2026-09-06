import { requirePermission } from "@/platform/auth/session";

import { RefundsWorkspace } from "@/app/(app)/refunds/refunds-workspace";
import { describeDecisions } from "@/modules/refunds/decisions";
import {
  getPolicy,
  getRefundDetail,
  listRefunds,
  summarizeRefunds,
  volumeByStatus,
} from "@/modules/refunds/queries";
import { isOpenStatus, parseListParams, type ListParams } from "@/modules/refunds/params";

export const dynamic = "force-dynamic";

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const actor = await requirePermission("refunds.read");
  const parsed = parseListParams(await searchParams);
  const params: ListParams = {
    ...parsed,
    decision: undefined,
    step: !parsed.refund ? 1 : parsed.step === 3 ? 3 : 2,
  };
  const [list, summary, volume, detail, policy] = await Promise.all([
    listRefunds(params),
    summarizeRefunds(),
    volumeByStatus(params.range),
    params.refund ? getRefundDetail(params.refund) : Promise.resolve(null),
    getPolicy(),
  ]);
  const options =
    detail && policy ? describeDecisions({ actor, refund: detail, policy }) : [];
  const open = list.filter((row) => isOpenStatus(row.status));
  const selectedIndex = open.findIndex((row) => row.id === params.refund);
  const nextOpen =
    open.find((row, index) => index > selectedIndex) ??
    open.find((row) => row.id !== params.refund) ??
    null;

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
      options={options}
      nextOpen={nextOpen}
    />
  );
}
