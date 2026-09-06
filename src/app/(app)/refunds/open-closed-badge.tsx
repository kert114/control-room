import { isOpenStatus, type RefundStatus } from "@/modules/refunds/params";

/** Open/closed is stated in words and shape, matching the status badge design. */
export function OpenClosedBadge({ status }: { status: RefundStatus }): React.ReactElement {
  const open = isOpenStatus(status);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-control border px-2 py-0.5 text-meta font-semibold uppercase tracking-wide ${
        open ? "border-ink bg-ink text-panel" : "border-line bg-page text-muted"
      }`}
    >
      <span aria-hidden="true">{open ? "○" : "●"}</span>
      {open ? "Open" : "Closed"}
    </span>
  );
}
