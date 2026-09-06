import Link from "next/link";

import { requirePermission } from "@/platform/auth/session";

import { RefundsWorkspaceB } from "@/app/(app)/refunds/compare/workspace-b";
import { describeDecisions } from "@/modules/refunds/decisions";
import {
  getPolicy,
  getRefundDetail,
  listRefunds,
  summarizeRefunds,
  volumeByStatus,
} from "@/modules/refunds/queries";
import {
  buildRefundsHref,
  parseListParams,
  REFUNDS_PATH,
  type ListParams,
} from "@/modules/refunds/params";

export const dynamic = "force-dynamic";

export default async function RefundsComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const actor = await requirePermission("refunds.read");
  const raw = await searchParams;
  const parsed = parseListParams(raw);
  const params: ListParams = {
    ...parsed,
    dir: raw.sort === undefined && raw.dir === undefined ? "asc" : parsed.dir,
    decision: undefined,
    step: !parsed.refund ? 1 : parsed.step === 3 ? 3 : 2,
  };
  const [list, summary, volume, detail, policy] = await Promise.all([
    listRefunds(params),
    summarizeRefunds(),
    volumeByStatus(),
    params.refund ? getRefundDetail(params.refund) : Promise.resolve(null),
    getPolicy(),
  ]);
  const options =
    detail && policy
      ? describeDecisions({ actor, refund: detail, policy })
      : [];
  const open = list.filter(
    (row) => row.status === "pending_approval" || row.status === "escalated",
  );
  const selectedIndex = open.findIndex((row) => row.id === params.refund);
  const nextOpen = open.find((row, index) => index > selectedIndex) ?? open.find((row) => row.id !== params.refund) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-control border border-line bg-panel px-3 py-2 text-meta text-muted">
        Variant B (fewer clicks, early rule messaging).{" "}
        <Link href={buildRefundsHref({ ...params, step: params.step === 3 ? 2 : params.step }, REFUNDS_PATH)} className="text-primary underline">
          Switch to variant A
        </Link>
      </p>
      <RefundsWorkspaceB
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
    </div>
  );
}
