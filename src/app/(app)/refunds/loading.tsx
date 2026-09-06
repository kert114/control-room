import { Panel } from "@/platform/ui/panel";

export default function Loading(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title font-medium text-ink">Refunds</h1>
        <p className="text-body text-muted">
          Review refund requests and decide them under the four-eyes rule.
        </p>
      </div>
      <Panel title="Refund queue">
        <div aria-busy="true" className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-10 animate-pulse bg-line" />
          ))}
        </div>
      </Panel>
    </div>
  );
}
